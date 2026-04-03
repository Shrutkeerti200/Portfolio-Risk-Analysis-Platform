import { Navigate } from 'react-router-dom';
import { useAuth } from '/src/context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900flex items-center justify-center">
                <div className="animate-spin rounder-full h-12 w-12 border-t-t2 border-blue-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}