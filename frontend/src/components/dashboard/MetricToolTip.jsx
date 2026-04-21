import { useState } from 'react';

export default function MetricTooltip({ children, tooltip }) {
    const [show, setShow] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}

            {/* Tooltip */}
            {show && tooltip && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 pointer-events-none">
                    <div className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 shadow-xl">
                        <p className="text-gray-200 text-xs leading-relaxed">{tooltip}</p>
                    </div>
                    {/* Arrow */}
                    <div className="flex justify-center">
                        <div className="w-2.5 h-2.5 bg-gray-900 border-r border-b border-gray-600 transform rotate-45 -mt-1.5"></div>
                    </div>
                </div>
            )}
        </div>
    );
}