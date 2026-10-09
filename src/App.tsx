import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { AuthPage } from './pages/AuthPage'
import { DashboardHome } from './pages/DashboardHome'
import { LandingPage } from './pages/LandingPage'
import { ProfilePage } from './pages/ProfilePage'
import { PropertiesPage } from './pages/PropertiesPage'
import { PropertyDetailPage } from './pages/PropertyDetailPage'
import { PropertyFormPage } from './pages/PropertyFormPage'
import { LeadsPage } from './pages/LeadsPage'
import { LeadFormPage } from './pages/LeadFormPage'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { FollowUpsPage } from './pages/FollowUpsPage'
import { SchedulingPage } from './pages/SchedulingPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import WhatsAppEnquiry from './pages/WhatsAppEnquiry'
import WhatsAppBusinessPage from './pages/WhatsAppBusinessPage'
import { AboutPage } from './pages/AboutPage'
import { BillingPage } from './pages/BillingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/new" element={<PropertyFormPage />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="properties/:id/edit" element={<PropertyFormPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/new" element={<LeadFormPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="leads/:id/edit" element={<LeadFormPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="scheduling" element={<SchedulingPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="whatsapp" element={<WhatsAppEnquiry />} />
        <Route path="whatsapp-business" element={<WhatsAppBusinessPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<ProfilePage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
