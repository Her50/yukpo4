import React from 'react'
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: [
    "../src/stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/experimental-addon-test",
  ],
  docs: {
    autodocs: "tag",
  },
  viteFinal(config) {
    return {
      ...config,
      resolve: {
        alias: {
          "@": new URL("../src", import.meta.url).pathname,
        },
      },
    };
  },
  refs: {},
  // Classement visuel personnalisé dans Storybook
  previewAnnotations: [],
  experimental_indexers: undefined,
  frameworkOptions: {},
  managerHead: (head) => head,
  previewHead: (head) => head,
  sortStories: {
    order: [
      "🏠 Accueil",
      ["HomePage"],
      "🧰 Services",
      ["ServicesPage", "CreationPage", "OutilsPage"],
      "🤖 Matching Yukpomnang",
      ["MatchingPage", "MatchingResultsIA"],
      "📦 Produits",
      ["BienPage", "TicketPage", "BourseLivrePage"],
      "📈 Dashboards",
      ["DashboardPage", "UserStatsIADashboard", "PredictionDashboard", "StrategicRecoPanel"],
      "🧪 Admin",
      ["AdminPanel", "AdminAnalyticsPanel", "CommunicationPanel", "UserInteractionIACenter"],
      "🔐 Paiement & Abonnement",
      ["UpgradePage", "PaiementProPage", "ContactEnterprisePage"],
      "🔍 Autres",
    ],
  },
};
export default config;
