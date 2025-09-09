import React from "react";
import { useLocation, Routes, Route } from "react-router-dom";
import { AnimatePresence, motion, Variants } from "framer-motion";

import LoginPage from './pages/LoginPage';
import AboutPage from './pages/AboutPage'; // <- AboutPage n’a pas encore de route définie dans ROUTES, on utilisera "/about"
import ContactPage from './pages/ContactPage';
import Dashboard from './pages/Dashboard';
import YukpomnangPremium from './pages/dashboard/IAPremium';
import MonProfil from './pages/dashboard/MonProfil';
import NotFound from './pages/NotFound';
import DashboardLayout from './layouts/DashboardLayout';
import ServicesPage from './pages/ServicesPage';
import RequirePlan from './components/security/RequirePlan';
import AnimationDebugger from './components/dev/AnimationDebugger';
import MesServices from './pages/dashboard/MesServices';
import ResultatsBesoin from './pages/ResultatsBesoin';

import { ROUTES } from "@/routes/AppRoutesRegistry";
import routeAnimations from './routeAnimations.json';

type AnimationName = "fade" | "slide" | "zoom" | "flip";

const animationVariants: Record<AnimationName, Variants> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } },
  zoom: { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } },
  flip: { initial: { rotateY: 90, opacity: 0 }, animate: { rotateY: 0, opacity: 1 }, exit: { rotateY: 90, opacity: 0 } }
};

const getVariantFromPath = (path: string): { name: AnimationName; variant: Variants } => {
  const key = Object.keys(routeAnimations).find((route) =>
    path === route || path.startsWith(route)
  );
  const raw = (routeAnimations as Record<string, string>)[key || ""] ?? "fade";
  const name = ["fade", "slide", "zoom", "flip"].includes(raw)
    ? (raw as AnimationName)
    : "fade";
  return { name, variant: animationVariants[name] };
};

const LayoutRoutes: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const { name, variant } = getVariantFromPath(path);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={path}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variant}
        transition={{ duration: 0.3 }}
        className="min-h-screen"
      >
        <Routes location={location}>
          {/* Routes publiques */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path="/about" element={<AboutPage />} /> {/* route non déclarée dans ROUTES */}
          <Route path={ROUTES.CONTACT} element={<ContactPage />} />
          <Route path={ROUTES.SERVICES} element={<ServicesPage />} />
          <Route path="/resultats-besoin" element={<ResultatsBesoin />} />

          {/* Dashboard sécurisé */}
          <Route path={ROUTES.DASHBOARD} element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route
              path="ia-premium"
              element={
                <RequirePlan plan="enterprise">
                  <YukpomnangPremium />
                </RequirePlan>
              }
            />
            <Route path="mes-services" element={<MesServices />} />
            <Route path="profil" element={<MonProfil />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        <AnimationDebugger animation={name} />
      </motion.div>
    </AnimatePresence>
  );
};

export default LayoutRoutes;
