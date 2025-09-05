export function formatStart(startTime: string): string {
  const date = new Date(startTime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffInDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (diffInDays === 0) {
    return `Today ${timeStr}`;
  } else if (diffInDays === 1) {
    return `Tomorrow ${timeStr}`;
  } else if (diffInDays === -1) {
    return `Yesterday ${timeStr}`;
  } else if (diffInDays > 1 && diffInDays < 7) {
    return `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${timeStr}`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

export function isStarted(startTime: string): boolean {
  return new Date(startTime) <= new Date();
}

export function timeUntilStart(startTime: string): {
  days: number;
  hours: number;
  minutes: number;
  total: number;
} {
  const target = new Date(startTime).getTime();
  const now = new Date().getTime();
  const total = Math.max(0, target - now);
  
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes, total };
}

export function countdown(startTime: string): string {
  const { days, hours, minutes, total } = timeUntilStart(startTime);
  
  if (total <= 0) return 'Started';
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}