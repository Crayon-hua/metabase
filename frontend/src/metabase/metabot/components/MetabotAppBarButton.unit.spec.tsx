import userEvent from "@testing-library/user-event";

import { mockSettings } from "__support__/settings";
import { createMockState } from "__support__/state";
import { renderWithProviders, screen, within } from "__support__/ui";
import * as Analytics from "metabase/analytics";
import { Route } from "metabase/router";
import { createMockUser } from "metabase-types/api/mocks";

import { MetabotProvider } from "../context";
import { EXTERNAL_AGENT_NAME } from "../externalAgent";

import { MetabotAppBarButton } from "./MetabotAppBarButton";

interface SetupOpts {
  pathname?: string;
  authenticated?: boolean;
  metabotIcon?: string;
}

function setup({
  pathname = "/",
  authenticated = true,
  metabotIcon = "metabot",
}: SetupOpts = {}) {
  const settings = mockSettings({
    "metabot-name": EXTERNAL_AGENT_NAME,
    "metabot-icon": metabotIcon,
  });

  const TestComponent = () => (
    <MetabotProvider>
      <MetabotAppBarButton />
    </MetabotProvider>
  );

  const { store } = renderWithProviders(
    <Route path="*" element={<TestComponent />} />,
    {
      withRouter: true,
      initialRoute: pathname,
      storeInitialState: createMockState({
        settings,
        currentUser: authenticated ? createMockUser() : null,
      }),
    },
  );

  return { store };
}

describe("MetabotAppBarButton", () => {
  it("should render the button for authenticated users", () => {
    setup({ authenticated: true });
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
      }),
    ).toBeInTheDocument();
  });

  it("should not render the button when unauthenticated", () => {
    setup({ authenticated: false });
    expect(
      screen.queryByRole("button", {
        name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    "/question/ask",
    "/question/ask/",
    "/metabot/conversation/past-conversation-id",
  ])(
    "should disable the button on the full-page metabot surface (%s)",
    (pathname) => {
      setup({ pathname });
      expect(
        screen.getByRole("button", {
          name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
        }),
      ).toBeDisabled();
    },
  );

  it("should not disable the button on other question pages", () => {
    setup({ pathname: "/question/123" });
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
      }),
    ).toBeEnabled();
  });

  it("should toggle metabot visibility when clicked", async () => {
    const { store } = setup();

    // Unjustified type cast. FIXME
    const initialState = store.getState() as any;
    expect(initialState.metabot.agents.omnibot.visible).toBe(false);

    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
      }),
    );

    // Unjustified type cast. FIXME
    const newState = store.getState() as any;
    expect(newState.metabot.agents.omnibot.visible).toBe(true);
  });

  it("should track opening the chat from the header, but not closing it", async () => {
    const trackEvent = jest.mocked(Analytics.trackSimpleEvent);
    trackEvent.mockClear();
    setup();
    const button = screen.getByRole("button", {
      name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
    });

    await userEvent.click(button);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({
      event: "metabot_chat_opened",
      triggered_from: "header",
    });

    await userEvent.click(button);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("should use the custom metabot icon", () => {
    setup({
      metabotIcon: "data:image/png;base64,iVBORw0KGgo=",
    });

    const button = screen.getByRole("button", {
      name: new RegExp(`Chat with ${EXTERNAL_AGENT_NAME}`),
    });
    expect(
      within(button).getByRole("img", { name: EXTERNAL_AGENT_NAME }),
    ).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
  });
});
