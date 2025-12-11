'use client';

interface SessionWarningModalProps {
  isOpen: boolean;
  timeRemaining: number; // in milliseconds
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export default function SessionWarningModal({
  isOpen,
  timeRemaining,
  onStayLoggedIn,
  onLogoutNow,
}: SessionWarningModalProps) {
  if (!isOpen) return null;

  // Convert milliseconds to minutes and seconds
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mb-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Session Timeout Warning
          </h3>
          
          <p className="text-sm text-gray-500 mb-4">
            You have been inactive for a while. Your session will expire soon.
          </p>
          
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <p className="text-xs text-gray-500">
              Time remaining before automatic logout
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onLogoutNow}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Logout Now
            </button>
            <button
              onClick={onStayLoggedIn}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

