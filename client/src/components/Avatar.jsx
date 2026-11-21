import React from 'react';

const GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-600 to-teal-600',
  'from-purple-600 to-pink-600',
  'from-amber-600 to-orange-600',
  'from-cyan-600 to-blue-600',
  'from-rose-600 to-red-600',
  'from-violet-600 to-purple-600',
  'from-teal-600 to-emerald-600'
];

function getGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({
  user,
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  className = ''
}) {
  const displayName = name || user?.displayName || user?.username || 'User';
  const photo = avatarUrl || user?.avatar;

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-24 h-24 text-2xl font-bold',
    '2xl': 'w-32 h-32 text-4xl font-bold'
  };

  const badgeSizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-6 h-6 border-4',
    '2xl': 'w-8 h-8 border-4'
  };

  const chosenSize = sizeClasses[size] || sizeClasses.md;
  const chosenBadge = badgeSizeClasses[size] || badgeSizeClasses.md;
  const gradient = getGradient(displayName);
  const initials = getInitials(displayName);

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {photo ? (
        <img
          src={photo}
          alt={displayName}
          className={`${chosenSize} rounded-full object-cover border border-slate-700/80 shadow`}
          onError={(e) => {
            // If image fails to load, hide image and show initials
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${chosenSize} rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-bold tracking-wider shadow border border-white/10`}
        >
          {initials}
        </div>
      )}

      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${chosenBadge} bg-emerald-500 border-2 border-slate-900 rounded-full`}
        />
      )}
    </div>
  );
}
