export async function api<T>(url:string, options:RequestInit={}):Promise<T> {
  const response=await fetch('/api'+url,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'LankaTable',...options.headers}});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'Something went wrong. Please try again.');
  return result;
}
export const send=(method:string,body:unknown):RequestInit=>({method,body:JSON.stringify(body)});
export const money=(value:string|number|null)=>value===null?'No menu yet':new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR',maximumFractionDigits:2,minimumFractionDigits:0}).format(Number(value));
export const spiceNames=['Not spicy','Mild','Medium','Hot'];
export const appName=import.meta.env.VITE_APP_NAME||'Lanka Table';
