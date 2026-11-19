(ns metabase.query-knowledge.retrieve
  "Hybrid keyword + vector evidence retrieval, ported from sql-agent retrieve.go."
  (:require
   [clojure.string :as str]
   [metabase.query-knowledge.db :as qk.db]
   [metabase.query-knowledge.embed :as qk.embed]
   [metabase.query-knowledge.metadata :as qk.metadata]
   [metabase.util.json :as json]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]))

(def ^:private latin-word-re #"[a-z0-9_]+")

(defn- matches?
  "Keyword match: whole latin token, otherwise substring (case-insensitive question)."
  [question value]
  (let [value (-> value str/trim str/lower-case)]
    (cond
      (str/blank? value) false
      (re-matches latin-word-re value)
      (boolean (some #{value} (re-seq latin-word-re question)))
      :else
      (str/includes? question value))))

(defn- match-name?
  [question name synonyms]
  (or (matches? question name)
      (some #(matches? question %) synonyms)))

(defn- word-break [name]
  (-> name (str/replace #"[_-]" " ")))

(defn- cosine
  "Cosine similarity of two equal-length float sequences. Returns 0 when either is empty/zero."
  [a b]
  (let [a (vec a)
        b (vec b)]
    (if (or (empty? a) (not= (count a) (count b)))
      0.0
      (loop [i 0 dot 0.0 na 0.0 nb 0.0]
        (if (= i (count a))
          (let [denom (* (Math/sqrt na) (Math/sqrt nb))]
            (if (zero? denom) 0.0 (/ dot denom)))
          (let [x (double (nth a i))
                y (double (nth b i))]
            (recur (inc i) (+ dot (* x y)) (+ na (* x x)) (+ nb (* y y)))))))))

(defn- parse-embedding [s]
  (cond
    (sequential? s) (mapv double s)
    (string? s)     (mapv double (json/decode s))
    :else           []))

(defn- nearest-documents
  "App-side cosine nearest neighbors, partitioned by kind (table<=6, term<=4)."
  [docs query-vec]
  (let [scored (for [doc docs]
                 (let [emb (parse-embedding (:embedding doc))]
                   (assoc doc :_score (cosine query-vec emb))))
        by-kind (group-by :kind scored)
        pick (fn [kind limit]
               (->> (get by-kind kind [])
                    (sort-by (juxt (comp - :_score) :position))
                    (take limit)))]
    (vec (concat (pick "table" 6) (pick "term" 4)))))

(defn- normalize-body [body]
  {:aliases   (vec (or (:aliases body) []))
   :terms     (vec (or (:terms body) []))
   :relations (vec (or (:relations body) []))})

(mu/defn retrieve-evidence
  "Hybrid retrieve for `database-id` + `question`.
   Returns {:evidence {...} :warning (maybe string)}."
  [database-id :- ms/PositiveInt
   question    :- ms/NonBlankString]
  (let [normalized (-> question str/lower-case)
        row        (qk.db/by-database-id database-id)
        body       (normalize-body (or (:body row) qk.db/empty-body))
        tables     (qk.metadata/catalog-tables database-id)
        terms      (:terms body)
        aliases    (:aliases body)
        ;; Keyword term hits
        term-ids   (into []
                         (keep-indexed
                          (fn [i term]
                            (when (match-name? normalized (:name term) (or (:synonyms term) []))
                              i)))
                         terms)
        ;; Vector nearest
        ident      (qk.embed/embedding-identity)
        stored-id  (or (:embedding_model row) "")
        [nearest warning]
        (cond
          (str/blank? ident)
          [[] nil]

          (and (not (str/blank? stored-id)) (not= ident stored-id))
          [[] "向量索引需要重新同步，已使用关键词召回。"]

          :else
          (try
            (let [qvec (first (qk.embed/embed! [question]))
                  docs (qk.db/documents-for-database database-id (or (:revision row) 0))]
              (if (seq docs)
                [(nearest-documents docs qvec) nil]
                [[] nil]))
            (catch Exception e
              (log/warnf e "Vector retrieve failed; falling back to keywords")
              [[] "向量召回暂不可用，已使用关键词召回。"])))
        term-ids   (into term-ids
                         (comp (filter #(= "term" (:kind %)))
                               (map :position)
                               (remove (set term-ids)))
                         nearest)
        selected-terms (->> term-ids
                            (take 12)
                            (keep #(nth terms % nil))
                            vec)
        term-context   (str normalized " "
                            (str/join " " (map #(str/lower-case (or (:description %) ""))
                                               selected-terms)))
        positions      (into {} (map-indexed (fn [i t] [(:name t) i]) tables))
        columns        (into {}
                             (map (fn [t]
                                    [(:name t)
                                     (into #{} (map :name) (:columns t))]))
                             tables)
        scores         (vec (repeat (count tables) 0))
        scores
        (reduce-kv
         (fn [sc i t]
           (cond-> sc
             (or (matches? term-context (:name t))
                 (matches? normalized (word-break (:name t))))
             (update i #(+ % 15))
             (and (>= (count (or (:comment t) "")) 2)
                  (matches? normalized (:comment t)))
             (update i #(+ % 6))))
         scores
         (vec tables))
        scores
        (reduce
         (fn [sc t]
           (reduce
            (fn [sc col]
              (if (or (matches? normalized (:name col))
                      (and (>= (count (or (:comment col) "")) 2)
                           (matches? normalized (:comment col))))
                (update sc (positions (:name t)) #(+ % 3))
                sc))
            sc
            (:columns t)))
         scores
         tables)
        scores
        (reduce
         (fn [sc a]
           (if-let [i (positions (:table a))]
             (if (and (or (str/blank? (:column a))
                          (contains? (columns (:table a)) (:column a)))
                      (match-name? normalized (:name a) (or (:synonyms a) [])))
               (update sc i #(+ % 30))
               sc)
             sc))
         scores
         aliases)
        scores
        (second
         (reduce
          (fn [[rank sc] d]
            (if (and (= "table" (:kind d))
                     (< (:position d) (count sc)))
              [(inc rank) (update sc (:position d) #(+ % (- 8 rank)))]
              [rank sc]))
          [0 scores]
          (filter #(= "table" (:kind %)) nearest)))
        order (vec (sort-by (fn [i] [(- (nth scores i)) i]) (range (count tables))))
        selected
        (loop [acc {} xs order]
          (if (or (empty? xs)
                  (>= (count acc) 8)
                  (and (> (count tables) 8)
                       (zero? (nth scores (first xs)))))
            acc
            (recur (assoc acc (:name (nth tables (first xs))) true)
                   (rest xs))))]
    (if (and (empty? selected) (seq tables))
      {:evidence {:schema [] :aliases [] :businessTerms [] :relations []}
       :warning  (or warning "未找到相关表，请补充业务名称或配置表字段同义词")
       :error    "no-tables"}
      (let [;; All candidate relations (knowledge + FK)
            all-rels (into []
                           (concat
                            (filter (fn [r]
                                      (and (contains? (columns (:table r)) (:column r))
                                           (contains? (columns (:targetTable r)) (:targetColumn r))))
                                    (:relations body))
                            (mapcat #(or (:relations %) []) tables)))
            neighbors
            (reduce
             (fn [m r]
               (-> m
                   (update (:table r) (fnil conj #{}) (:targetTable r))
                   (update (:targetTable r) (fnil conj #{}) (:table r))))
             {}
             all-rels)
            bridges
            (->> tables
                 (map :name)
                 (remove selected)
                 (filter (fn [name]
                           (>= (count (filter selected (get neighbors name #{}))) 2)))
                 (take 4))
            selected (reduce #(assoc %1 %2 true) selected bridges)
            evidence-tables
            (->> tables
                 (filter #(selected (:name %)))
                 (map #(dissoc % :relations))
                 vec)
            evidence-aliases
            (filterv (fn [a]
                       (and (selected (:table a))
                            (or (str/blank? (:column a))
                                (contains? (columns (:table a)) (:column a)))))
                     aliases)
            evidence-rels
            (filterv (fn [r]
                       (and (selected (:table r)) (selected (:targetTable r))))
                     all-rels)
            ;; dedupe relations
            evidence-rels (vec (distinct evidence-rels))]
        {:evidence {:schema         evidence-tables
                    :aliases        evidence-aliases
                    :businessTerms  selected-terms
                    :relations      evidence-rels}
         :warning  warning}))))
