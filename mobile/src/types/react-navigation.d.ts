import { BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import { NavigationHelpers, ParamListBase } from '@react-navigation/native';

declare module '@react-navigation/bottom-tabs' {
  interface BottomTabNavigationEventMap {
    tabPress: {
      data: {
        route: {
          key: string;
          name: string;
          params?: any;
        };
      };
      canPreventDefault: boolean;
      preventDefault(): void;
    };
  }
}

