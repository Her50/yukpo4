import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import PharmaciePage from './pages/PharmaciePage'
import BourseLivrePage from './pages/BourseLivrePage'
import RestaurantPage from './pages/RestaurantPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pharmacie" element={<><PharmaciePage /><BottomNav /></>} />
          <Route path="/livres" element={<><BourseLivrePage /><BottomNav /></>} />
          <Route path="/restaurant" element={<><RestaurantPage /><BottomNav /></>} />
          <Route path="*" element={<Navigate to="/pharmacie" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
