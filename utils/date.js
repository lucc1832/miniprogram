
function pad(n){return n<10?("0"+n):(""+n)}
function todayStr(){
  const d=new Date()
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())
}
function diffDays(aStr,bStr){
  // a - b in days
  const a=new Date(aStr+"T00:00:00")
  const b=new Date(bStr+"T00:00:00")
  return Math.floor((a-b)/86400000)
}
module.exports={todayStr,diffDays}
