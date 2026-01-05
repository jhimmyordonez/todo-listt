import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { TodosPage } from './pages/TodosPage';
import { GoalsPage } from './pages/GoalsPage';
import { SummaryPage } from './pages/SummaryPage';
import { VocabularyPage } from './pages/VocabularyPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/todos" element={<TodosPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/vocabulary" element={<VocabularyPage />} />
            <Route path="/summary" element={<SummaryPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/todos" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

