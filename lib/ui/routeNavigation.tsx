'use client';

import { createContext, useContext } from 'react';

type RouteNavigationContextValue = {
  isNavigating: boolean;
};

export const RouteNavigationContext = createContext<RouteNavigationContextValue>({
  isNavigating: false,
});

export function useRouteNavigation() {
  return useContext(RouteNavigationContext);
}
