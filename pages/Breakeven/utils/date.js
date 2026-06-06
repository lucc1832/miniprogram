
function pad(n){return n<10?("0"+n):(""+n)}

function todayStr(){
  const d=new Date()
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())
}

function diffDays(aStr,bStr){
  // a - b in days
  // compatible with "YYYY-MM-DD" or Date object
  const a = typeof aStr === 'string' ? new Date(aStr.replace(/-/g, '/') + " 00:00:00") : aStr;
  const b = typeof bStr === 'string' ? new Date(bStr.replace(/-/g, '/') + " 00:00:00") : bStr;
  
  // reset hours just in case
  if (a instanceof Date) a.setHours(0,0,0,0);
  if (b instanceof Date) b.setHours(0,0,0,0);

  return Math.floor((a-b)/86400000);
}

/**
 * Calculate display days for an event
 * @param {Object} event - The event object
 * @param {Date} [today] - Optional reference date
 * @returns {Object} { days: number, label: string, isFuture: boolean }
 */
function calcEventDays(event, today) {
  if (!today) {
    today = new Date();
    today.setHours(0, 0, 0, 0);
  }

  // Handle Lunar later if needed, currently use solar date
  let targetDate = new Date(event.date.replace(/-/g, '/'));
  targetDate.setHours(0,0,0,0);

  let days = 0;
  let label = '';
  let isFuture = false;

  if (event.type === 'anniversary') {
    // Anniversary: How long has it been?
    // targetDate is usually in the past.
    // We want today - targetDate
    const diff = today - targetDate;
    days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // If future date set as anniversary? Treat as 0 or absolute diff?
    // User logic: Anniversary = "Has happened".
    if (days < 0) days = Math.abs(days); // Just show abs diff
    
    label = '已经';
    isFuture = false;
  } else {
    // Countdown: How long until?
    // Logic: If targetDate < today, find next occurrence.
    if (targetDate < today) {
        const nextYear = new Date(targetDate);
        nextYear.setFullYear(today.getFullYear());
        if (nextYear < today) {
            nextYear.setFullYear(today.getFullYear() + 1);
        }
        targetDate = nextYear;
    }
    
    const diff = targetDate - today;
    days = Math.floor(diff / (1000 * 60 * 60 * 24));
    label = days === 0 ? '就是' : '还有';
    isFuture = true;
  }

  return { days, label, isFuture };
}

module.exports={todayStr, diffDays, calcEventDays}
