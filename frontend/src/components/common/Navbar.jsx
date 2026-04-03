import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    ChartBarIcon,
    BriefcaseIcon,
    BellIcon,
    CogIcon,
    ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', label: 'Dashboard', icon: ChartBarIcon },
        { name: 'Portfolios', label: 'Portfolios', icon: BriefcaseIcon },
        { name: 'Alerts', label: 'Alerts', icon: BellIcon },
        { name: 'Settings', label: 'Settings', icon: CogIcon },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-8">
                        <Link to="/dashboard" className="text-xl font-bold text-white">
                            RiskPlatform
                        </Link>
                        <div className="hidden md:flex space-x-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        isActive(item.path)
                                            ? 'bg-gray-900 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <item.icon className="h-5 w-5 mr-1.5" />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-300">
                            {user?.firstName} {user?.lastName}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center text-gray-300 hover:text-white transition-colors"
                        >
                            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}