/** @vitest-environment jsdom */

import { act } from "react";
import type { ReactNode } from "react";
import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PermissionSnapshot } from "@/types";
import { AISettingsPage, SettingsCenterPage } from "./settings-pages";

const testState = vi.hoisted(() => ({
  snapshot: {
    permissionKeys: [
      "settings.identity.view",
      "settings.identity.manage",
      "settings.branding.view",
      "settings.ai.view",
      "settings.ai.manage",
      "observe.ai.view",
    ],
    visibleMenuIds: [
      "settings",
      "account-profile",
      "settings-about",
      "settings-login",
      "settings-branding",
    ],
    visibleMenus: [
      { id: "settings", path: "/settings", labelZh: "设置中心" },
      {
        id: "account-profile",
        parentId: "settings",
        path: "/account/profile",
        labelZh: "个人中心",
        sortOrder: 10,
      },
      {
        id: "settings-about",
        parentId: "settings",
        path: "/settings/about",
        labelZh: "关于",
        sortOrder: 20,
      },
      {
        id: "settings-login",
        parentId: "settings",
        path: "/settings/login",
        labelZh: "登陆设置",
        sortOrder: 261,
      },
      {
        id: "settings-branding",
        parentId: "settings",
        path: "/settings/branding",
        labelZh: "品牌设置",
        sortOrder: 262,
      },
    ],
  } as PermissionSnapshot,
  responses: {} as Record<string, unknown>,
}));

const apiGetMock = vi.hoisted(() =>
  vi.fn((path: string) =>
    Promise.resolve({ data: testState.responses[path] ?? {} }),
  ),
);
const apiPostMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })));
const apiPutMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })));

vi.mock("@/features/auth/permission-snapshot", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/permission-snapshot")
  >("@/features/auth/permission-snapshot");
  return {
    ...actual,
    usePermissionSnapshot: () => ({
      data: { data: testState.snapshot },
      isLoading: false,
    }),
  };
});

vi.mock("@/services/api-client", () => ({
  api: {
    get: apiGetMock,
    put: apiPutMock,
    post: apiPostMock,
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

vi.mock("@/components/admin-table", () => ({
  AdminTable: ({
    title,
    headerExtra,
    toolbar,
    toolbarExtra,
    dataSource,
    columns,
  }: {
    title?: ReactNode;
    headerExtra?: ReactNode;
    toolbar?: ReactNode;
    toolbarExtra?: ReactNode;
    dataSource: unknown[];
    columns?: Array<{
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: unknown, index: number) => ReactNode;
    }>;
  }) => (
    <div data-testid="admin-table">
      {title ? <div>{title}</div> : null}
      {headerExtra ? <div data-testid="admin-table-header-extra">{headerExtra}</div> : null}
      {toolbar ? <div data-testid="admin-table-toolbar">{toolbar}</div> : null}
      {toolbarExtra ? <div data-testid="admin-table-toolbar-extra">{toolbarExtra}</div> : null}
      <div>{`rows:${dataSource.length}`}</div>
      {dataSource.map((item, index) => (
        <div key={index}>
          <div>{JSON.stringify(item)}</div>
          {columns?.map((column, columnIndex) => (
            <span key={`${column.key || column.dataIndex || "column"}-${columnIndex}`}>
              {column.render
                ? column.render(
                    column.dataIndex
                      ? (item as Record<string, unknown>)[column.dataIndex]
                      : undefined,
                    item,
                    index,
                  )
                : null}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

let containers: HTMLDivElement[] = [];
let roots: Array<ReturnType<typeof createRoot>> = [];

function setDefaultResponses() {
  testState.responses = {
    "/settings/identity": {
      providers: [
        {
          id: "corp-oidc",
          name: "OIDC",
          type: "oidc",
          enabled: true,
          issuer: "https://accounts.example.com",
          clientId: "client",
          clientSecret: "secret",
          redirectUrl:
            "http://127.0.0.1:8080/api/v1/auth/login/corp-oidc/callback",
          frontendRedirectUrl: "http://127.0.0.1:5173/login/callback",
          scopes: ["openid", "profile", "email"],
          defaultRoles: ["readonly"],
          userIdField: "sub",
          userNameField: "name",
          emailField: "email",
        },
      ],
      defaultProviderId: "corp-oidc",
    },
    "/settings/branding": {
      appTitle: "Soha",
      sidebarTitle: "Soha",
    },
    "/settings/ai": {
      workbenchModel: {
        enabled: true,
        defaultPublicModel: "gpt-public",
        defaultRouteId: "route-openai",
        defaultEndpoint: "chat/completions",
      },
      skillsRegistry: [
        {
          id: "skill-1",
          name: "Skill One",
          category: "observability",
          enabled: true,
        },
      ],
    },
    "/ai-gateway/relay/model-routes?includeDisabled=true": [
      {
        id: "route-openai",
        publicModel: "gpt-public",
        upstreamId: "upstream-openai",
        upstreamModel: "gpt-4.1-mini",
        endpoint: "chat/completions",
        enabled: true,
      },
      {
        id: "route-disabled",
        publicModel: "gpt-disabled",
        upstreamId: "upstream-disabled",
        upstreamModel: "gpt-disabled",
        endpoint: "chat/completions",
        enabled: false,
      },
    ],
    "/copilot/data-sources": [],
    "/copilot/analysis-profiles": [],
    "/copilot/automation-policies": [],
    "/copilot/data-source-capabilities": [],
    "/copilot/workbench/catalog": {
      agentProviders: [
        {
          id: "internal",
          kind: "internal",
          name: "soha 内置分析",
          enabled: true,
          default: true,
          capabilities: ["root_cause"],
          supportsAsync: false,
          supportsSkills: true,
          supportsToolsets: true,
        },
        {
          id: "hermes",
          kind: "hermes",
          name: "Hermes Agent",
          description: "通过 soha agent runner 调用 Hermes CLI。",
          enabled: true,
          capabilities: ["root_cause", "delivery_failure"],
          supportsAsync: true,
          supportsSkills: true,
          supportsToolsets: true,
        },
      ],
      capabilities: [
        { id: "root_cause", name: "根因分析" },
        { id: "delivery_failure", name: "发布失败分析" },
      ],
    },
    "/copilot/agent-runs": [
      {
        id: "agent-run-1",
        providerId: "hermes",
        providerKind: "hermes",
        capabilityId: "root_cause",
        status: "running",
        claimedByAgentId: "hermes-agent-runner",
        queuedAt: "2026-06-04T10:00:00Z",
        startedAt: "2026-06-04T10:01:00Z",
        lastHeartbeatAt: "2026-06-04T10:02:00Z",
        createdAt: "2026-06-04T10:00:00Z",
        updatedAt: "2026-06-04T10:02:00Z",
      },
    ],
  };
}

async function renderWithProviders(node: ReactNode, route: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const root = createRoot(container);
  roots.push(root);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[route]}
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {node}
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    );
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return container;
}

describe("settings ai page rendering", () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(window, "getComputedStyle", {
      writable: true,
      value: vi.fn().mockReturnValue({
        getPropertyValue: () => "",
        overflow: "auto",
        overflowX: "auto",
        overflowY: "auto",
      }),
    });
  });

  beforeEach(() => {
    testState.snapshot = {
      permissionKeys: [
        "settings.identity.view",
        "settings.identity.manage",
        "settings.branding.view",
        "settings.ai.view",
        "settings.ai.manage",
        "observe.ai.view",
      ],
      visibleMenuIds: [
        "settings",
        "account-profile",
        "settings-about",
        "settings-login",
        "settings-branding",
      ],
      visibleMenus: [
        { id: "settings", path: "/settings", labelZh: "设置中心" },
        {
          id: "account-profile",
          parentId: "settings",
          path: "/account/profile",
          labelZh: "个人中心",
          sortOrder: 10,
        },
        {
          id: "settings-about",
          parentId: "settings",
          path: "/settings/about",
          labelZh: "关于",
          sortOrder: 20,
        },
        {
          id: "settings-login",
          parentId: "settings",
          path: "/settings/login",
          labelZh: "登陆设置",
          sortOrder: 261,
        },
        {
          id: "settings-branding",
          parentId: "settings",
          path: "/settings/branding",
          labelZh: "品牌设置",
          sortOrder: 262,
        },
      ],
    };
    setDefaultResponses();
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount();
      }
    });
    roots = [];
    for (const container of containers) {
      container.remove();
    }
    containers = [];
    vi.clearAllMocks();
  });

  it("does not render AI settings as a settings-center tab anymore", async () => {
    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings",
    );

    expect(container.textContent).not.toContain("AI 设置");
    expect(container.textContent).not.toContain("Provider Connections");
    expect(container.textContent).toContain("个人中心");
    expect(container.textContent).toContain("关于");
    expect(container.textContent).toContain("登陆设置");
    expect(container.textContent).toContain("品牌设置");
  });

  it("renders settings landing from visible menus only", async () => {
    testState.snapshot = {
      permissionKeys: ["settings.identity.view", "settings.branding.view"],
      visibleMenuIds: ["settings", "settings-login"],
      visibleMenus: [
        { id: "settings", path: "/settings", labelZh: "设置中心" },
        {
          id: "settings-login",
          parentId: "settings",
          path: "/settings/login",
          labelZh: "登陆设置",
          sortOrder: 261,
        },
      ],
    };

    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings",
    );

    expect(container.textContent).toContain("登陆设置");
    expect(container.textContent).not.toContain("个人中心");
    expect(container.textContent).not.toContain("关于");
    expect(container.textContent).not.toContain("品牌设置");
  });

  it("renders about page without admin settings permissions", async () => {
    testState.snapshot = {
      permissionKeys: [],
      visibleMenuIds: ["settings", "settings-about"],
      visibleMenus: [
        { id: "settings", path: "/settings" },
        { id: "settings-about", parentId: "settings", path: "/settings/about" },
      ],
    };

    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings/about",
    );

    expect(container.textContent).toContain("关于 OpenSoha");
    expect(container.textContent).toContain("Apache-2.0");
  });

  it("renders login settings on /settings/login", async () => {
    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings/login",
    );

    expect(container.textContent).toContain("新增登录源");
    expect(container.textContent).toContain("OIDC");
    expect(container.textContent).not.toContain(
      "配置 OIDC、飞书、钉钉、企业微信、OAuth2 与 SAML 登录源。",
    );
  });

  it("renders empty login settings when providers are empty", async () => {
    testState.responses["/settings/identity"] = {
      providers: [],
      defaultProviderId: "",
    };

    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings/login",
    );

    expect(container.textContent).toContain("rows:0");
    expect(container.textContent).not.toContain("corp-oidc");
  });

  it("saves login source enabled state from the table switch", async () => {
    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings/login",
    );
    const enabledSwitch = container.querySelector(
      'button[role="switch"]',
    ) as HTMLButtonElement | null;

    expect(enabledSwitch).toBeTruthy();

    await act(async () => {
      enabledSwitch?.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(apiPutMock).toHaveBeenCalledWith("/settings/identity/providers", {
      providers: [
        expect.objectContaining({
          id: "corp-oidc",
          enabled: false,
        }),
      ],
      defaultProviderId: "corp-oidc",
    });
  });

  it("exposes login role and organization mapping fields", async () => {
    const container = await renderWithProviders(
      <SettingsCenterPage />,
      "/settings/login",
    );
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("新增登录源"),
    ) as HTMLButtonElement | undefined;

    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton?.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain("登录补充角色");
    expect(document.body.textContent).toContain("登录补充组织");
    expect(document.body.textContent).toContain("角色字段");
    expect(document.body.textContent).toContain("组织字段");
  });

  it("advances the login source step form without saving", async () => {
    await renderWithProviders(<SettingsCenterPage />, "/settings/login");
    const editButton = document.body.querySelector(
      'button[aria-label="编辑登录源"]',
    ) as HTMLButtonElement | null;

    expect(editButton).toBeTruthy();

    await act(async () => {
      editButton?.click();
      await Promise.resolve();
    });

    const nextButton = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("下一步"),
    ) as HTMLButtonElement | undefined;

    expect(nextButton).toBeTruthy();

    await act(async () => {
      nextButton?.click();
      await Promise.resolve();
    });

    expect(apiPutMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("上一步");
  });

  it("renders full AI settings content under ai-workbench model settings", async () => {
    const container = await renderWithProviders(
      <AISettingsPage embedded />,
      "/ai-workbench/model-settings",
    );

    expect(
      container.querySelector('[data-testid="ai-workbench-model-section"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ai-agent-runtime-section"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Workbench 默认模型");
    expect(container.textContent).toContain("模型 Provider 在 AI Gateway 管理");
    expect(container.textContent).toContain("gpt-public");
    expect(container.textContent).not.toContain("Provider Connections");
    expect(container.textContent).not.toContain("Base URL");
    expect(container.textContent).not.toContain("API Key");
    expect(container.textContent).toContain("刷新");
  });

  it("surfaces Agent Runtime providers and recent Hermes runs in model settings", async () => {
    const container = await renderWithProviders(
      <AISettingsPage embedded />,
      "/ai-workbench/model-settings",
    );

    expect(container.textContent).toContain("Hermes Agent");
    expect(container.textContent).toContain("hermes-agent-runner");
    expect(container.textContent).toContain("agent-run-1");
  });

  it("does not render legacy provider connection controls", async () => {
    const container = await renderWithProviders(
      <AISettingsPage embedded />,
      "/ai-workbench/model-settings",
    );

    expect(
      container.querySelector('[data-testid="ai-provider-connections-section"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="ai-provider-add"]')).toBeNull();
    expect(
      document.body.querySelector('[data-testid="ai-provider-modal"]'),
    ).toBeNull();
  });

  it("saves workbench model settings through the converged settings endpoint", async () => {
    const container = await renderWithProviders(
      <AISettingsPage embedded />,
      "/ai-workbench/model-settings",
    );
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("保存默认模型"),
    ) as HTMLButtonElement | undefined;

    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(apiPutMock).toHaveBeenCalledWith("/settings/ai/workbench-model", {
      workbenchModel: expect.objectContaining({
        enabled: true,
        defaultPublicModel: "gpt-public",
        defaultRouteId: "route-openai",
        defaultEndpoint: "chat/completions",
      }),
    });
  });

  it("saves skills registry without provider connection payloads", async () => {
    const container = await renderWithProviders(
      <AISettingsPage embedded />,
      "/ai-workbench/model-settings",
    );
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("保存 Skills"),
    ) as HTMLButtonElement | undefined;

    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(apiPutMock).toHaveBeenCalledWith("/settings/ai/skills", {
      skillsRegistry: [
        expect.objectContaining({
          id: "skill-1",
          name: "Skill One",
          enabled: true,
        }),
      ],
    });
    const serializedCalls = JSON.stringify(apiPutMock.mock.calls);
    expect(serializedCalls).not.toContain("apiKey");
    expect(serializedCalls).not.toContain("baseUrl");
  });

  it("offers skywalking as a traces backend option in AI data sources", async () => {
    const source = await import("./settings-pages");

    expect(source).toBeTruthy();
    expect(
      (
        source as unknown as {
          __testOnly?: { tracesBackendOptions?: Array<{ value: string }> };
        }
      ).__testOnly?.tracesBackendOptions?.map((item) => item.value),
    ).toEqual(["jaeger", "skywalking"]);
  });
});
