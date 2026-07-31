import { SCHEME_COOKIE, THEME_COOKIE } from "@/lib/theme/resolution";

/**
 * Script bloqueante anti-FOUC: aplica `.dark` antes de pintar
 * según cookie de esquema o preferencia + prefers-color-scheme.
 */
export function ThemeScript() {
  const code = `(function(){try{
var c=document.cookie||'';
function get(n){var m=c.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
var scheme=get('${SCHEME_COOKIE}');
var theme=get('${THEME_COOKIE}')||'sistema';
var dark=false;
if(scheme==='oscuro') dark=true;
else if(scheme==='claro') dark=false;
else {
  var pref=theme;
  if(pref==='oscuro') dark=true;
  else if(pref==='claro') dark=false;
  else dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
}
var r=document.documentElement;
if(dark) r.classList.add('dark'); else r.classList.remove('dark');
}catch(e){}})();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: code }}
      // Ejecutar antes del body para primera pintura correcta
    />
  );
}
