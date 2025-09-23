// @ts-check
import Footer from "@/components/Footer";
import HeaderController from "@/components/HeaderController";
import React, { useEffect, useState } from "react";
// import QuickAccessMenu from "@/components/tools/QuickAccessMenu";
// import DevFloatingMenu from "@/components/tools/DevFloatingMenu";
import FlushFloatingButton from "@/components/admin/FlushFloatingButton";
import ChatButton from "@/components/chat/ChatButton";
import ChatList from "@/components/chat/ChatList";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatNotifications from "@/components/notifications/ChatNotifications";
import VideoCallNotification from "@/components/notifications/VideoCallNotification";
import NotificationHistory from "@/components/notifications/NotificationHistory";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useChatManager } from "@/hooks/useChatManager";
import { useUser } from "@/hooks/useUser";
import { useVideoCallNotifications } from "@/hooks/useVideoCallNotifications";

interface AppLayoutProps {
  children: React.ReactNode;
  padding?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, padding = true }) => {
  const { user } = useUser();
  const {
    showChatList,
    openChatList,
    closeChatList,
    openChat,
    editMessage,
    deleteMessage
  } = useChatManager();

  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);

  const {
    incomingCalls,
    answerCall,
    declineCall,
    removeCall
  } = useVideoCallNotifications();

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    // Écouter les événements d'ouverture d'historique depuis la homepage
    const handleNotificationHistoryEvent = () => {
      setShowNotificationHistory(true);
    };

    const handleChatHistoryEvent = () => {
      setShowChatHistory(true);
    };

    window.addEventListener('open:notification:history', handleNotificationHistoryEvent);
    window.addEventListener('open:chat:history', handleChatHistoryEvent);
    
    return () => {
      window.removeEventListener('open:notification:history', handleNotificationHistoryEvent);
      window.removeEventListener('open:chat:history', handleChatHistoryEvent);
    };
  }, []);

  return (
    <>
      {/* 🌐 Barre supérieure + langue */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <HeaderController />
          <div className="flex items-center space-x-4">
            {user && <ChatNotifications userId={parseInt(user.id)} />}
            <LanguageSwitcher />
          </div>
        </div>
      </div>


      {/* 🌍 Contenu principal */}
      <main
        className={`pt-24 min-h-screen transition-all duration-300 bg-gradient-to-br from-yellow-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 ${padding ? "px-4 sm:px-6 lg:px-8" : ""
          }`}
      >
        <div className="max-w-7xl mx-auto relative">{children}</div>
      </main>

      {/* 📌 Footer général */}
      <Footer />

      {/* ✅ Menus contextuels intelligents */}
      {/* <QuickAccessMenu /> */}
      {/* {import.meta.env.DEV && <DevFloatingMenu />} */}

      {/* 🧼 Bouton flush automatique admin (dev only) */}
      {user?.role === "admin" && import.meta.env.DEV && (
        <FlushFloatingButton
          onFlushSuccess={() => {
            // Son de confirmation
            const audio = new Audio("/sounds/flush-success.mp3");
            audio.play();

            // Vibration
            if (navigator.vibrate) navigator.vibrate(150);

            // Tracking
            fetch("/api/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: user.id,
                action_type: "admin_flush",
                action_target: "flush-test-data",
              }),
            }).catch(() => { });

            // Recharger stats IA (si dashboard visible)
            const event = new CustomEvent("refresh:ia:load");
            window.dispatchEvent(event);
          }}
        />
      )}

      {/* 🌐 Chat global - ACCESSIBLE PARTOUT */}
      {user && (
        <>
          <div className="fixed bottom-6 right-6 flex flex-row gap-3 z-40">
            <ChatButton
              onClick={() => setShowNotificationHistory(true)}
              unreadCount={0}
              className="bg-orange-600 hover:bg-orange-700"
              title="Notifications"
            >
              🔔
            </ChatButton>
            <ChatButton
              onClick={() => setShowChatHistory(true)}
              unreadCount={0}
              className="bg-green-600 hover:bg-green-700"
              title="Historique des chats"
            >
              💬
            </ChatButton>
            <ChatButton
              onClick={openChatList}
              unreadCount={0}
              title="Chats actifs"
            >
              💭
            </ChatButton>
          </div>
          <ChatList
            isOpen={showChatList}
            onClose={closeChatList}
            onChatSelect={openChat}
            chats={[]} // TODO: Charger les chats depuis l'API
            loading={false}
          />
          <ChatHistory
            isOpen={showChatHistory}
            onClose={() => setShowChatHistory(false)}
            onChatSelect={openChat}
          />
          <NotificationHistory
            isOpen={showNotificationHistory}
            onClose={() => setShowNotificationHistory(false)}
          />
        </>
      )}

      {/* 📞 Notifications d'appel vidéo */}
      {incomingCalls.map((call) => (
        <VideoCallNotification
          key={call.id}
          call={call}
          onAnswer={answerCall}
          onDecline={declineCall}
          onDismiss={removeCall}
        />
      ))}
    </>
  );
};

export default AppLayout;
