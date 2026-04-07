import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    ChartBarIcon,
    BriefcaseIcon,
    BellIcon,
    CogIcon,
    Bars3Icon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: ChartBarIcon },
        { path: '/portfolios', label: 'Portfolios', icon: BriefcaseIcon },
        { path: '/notifications', label: 'Alerts', icon: BellIcon },
        { path: '/settings', label: 'Settings', icon: CogIcon },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-8">
                        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold text-white">
                            <svg className="w-7 h-7" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
                                        <stop offset="100%" style={{ stopColor: '#8b5cf6' }} />
                                    </linearGradient>
                                </defs>
                                <rect width="64" height="64" rx="14" fill="url(#navGrad)" />
                                <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="36" fill="white">R</text>
                            </svg>
                            Riskient
                        </Link>
                        <div className="hidden md:flex space-x-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
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

                    {/* Desktop user info */}
                    <div className="hidden md:flex items-center space-x-4">
                        <span className="text-sm text-gray-300">
                            {user?.firstName} {user?.lastName}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            Logout
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-gray-300 hover:text-white"
                        >
                            {mobileMenuOpen ? (
                                <XMarkIcon className="h-6 w-6" />
                            ) : (
                                <Bars3Icon className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden pb-4">
                        <div className="space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                        }`}
                                >
                                    <item.icon className="h-5 w-5 mr-2" />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="flex items-center justify-between px-3">
                                <span className="text-sm text-gray-300">
                                    {user?.firstName} {user?.lastName}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}