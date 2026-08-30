import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

function RootLayout() {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <Outlet />
    </div>
  );
}

function HomeRoute() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-12">
      <div className="space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">
          Auren / Web foundation
        </p>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
            A clear starting point for the Auren web experience.
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            This small, network-free shell establishes the browser foundation
            for future work.
          </p>
        </div>
      </div>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
