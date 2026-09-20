/* esm.sh - turndown@7.2.0 */
var g=Object.defineProperty;var L=Object.getOwnPropertyDescriptor;var I=Object.getOwnPropertyNames;var M=Object.prototype.hasOwnProperty;var H=(e,r)=>()=>(e&&(r=e(e=0)),r);var F=(e,r)=>{for(var t in r)g(e,t,{get:r[t],enumerable:!0})},$=(e,r,t,n)=>{if(r&&typeof r=="object"||typeof r=="function")for(let i of I(r))!M.call(e,i)&&i!==t&&g(e,i,{get:()=>r[i],enumerable:!(n=L(r,i))||n.enumerable});return e};var V=e=>$(g({},"__esModule",{value:!0}),e);var y={};F(y,{default:()=>U});var U,T=H(()=>{U={}});function W(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])}return e}function N(e,r){return Array(r+1).join(e)}function _(e){return e.replace(/^\n*/,"")}function G(e){for(var r=e.length;r>0&&e[r-1]===`
`;)r--;return e.substring(0,r)}var K=["ADDRESS","ARTICLE","ASIDE","AUDIO","BLOCKQUOTE","BODY","CANVAS","CENTER","DD","DIR","DIV","DL","DT","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","FRAMESET","H1","H2","H3","H4","H5","H6","HEADER","HGROUP","HR","HTML","ISINDEX","LI","MAIN","MENU","NAV","NOFRAMES","NOSCRIPT","OL","OUTPUT","P","PRE","SECTION","TABLE","TBODY","TD","TFOOT","TH","THEAD","TR","UL"];function A(e){return E(e,K)}var R=["AREA","BASE","BR","COL","COMMAND","EMBED","HR","IMG","INPUT","KEYGEN","LINK","META","PARAM","SOURCE","TRACK","WBR"];function b(e){return E(e,R)}function Y(e){return O(e,R)}var S=["A","TABLE","THEAD","TBODY","TFOOT","TH","TD","IFRAME","SCRIPT","AUDIO","VIDEO"];function j(e){return E(e,S)}function q(e){return O(e,S)}function E(e,r){return r.indexOf(e.nodeName)>=0}function O(e,r){return e.getElementsByTagName&&r.some(function(t){return e.getElementsByTagName(t).length})}var s={};s.paragraph={filter:"p",replacement:function(e){return`

`+e+`

`}};s.lineBreak={filter:"br",replacement:function(e,r,t){return t.br+`
`}};s.heading={filter:["h1","h2","h3","h4","h5","h6"],replacement:function(e,r,t){var n=Number(r.nodeName.charAt(1));if(t.headingStyle==="setext"&&n<3){var i=N(n===1?"=":"-",e.length);return`

`+e+`
`+i+`

`}else return`

`+N("#",n)+" "+e+`

`}};s.blockquote={filter:"blockquote",replacement:function(e){return e=e.replace(/^\n+|\n+$/g,""),e=e.replace(/^/gm,"> "),`

`+e+`

`}};s.list={filter:["ul","ol"],replacement:function(e,r){var t=r.parentNode;return t.nodeName==="LI"&&t.lastElementChild===r?`
`+e:`

`+e+`

`}};s.listItem={filter:"li",replacement:function(e,r,t){e=e.replace(/^\n+/,"").replace(/\n+$/,`
`).replace(/\n/gm,`
    `);var n=t.bulletListMarker+"   ",i=r.parentNode;if(i.nodeName==="OL"){var a=i.getAttribute("start"),f=Array.prototype.indexOf.call(i.children,r);n=(a?Number(a)+f:f+1)+".  "}return n+e+(r.nextSibling&&!/\n$/.test(e)?`
`:"")}};s.indentedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="indented"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){return`

    `+r.firstChild.textContent.replace(/\n/g,`
    `)+`

`}};s.fencedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="fenced"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){for(var n=r.firstChild.getAttribute("class")||"",i=(n.match(/language-(\S+)/)||[null,""])[1],a=r.firstChild.textContent,f=t.fence.charAt(0),u=3,l=new RegExp("^"+f+"{3,}","gm"),o;o=l.exec(a);)o[0].length>=u&&(u=o[0].length+1);var c=N(f,u);return`

`+c+i+`
`+a.replace(/\n$/,"")+`
`+c+`

`}};s.horizontalRule={filter:"hr",replacement:function(e,r,t){return`

`+t.hr+`

`}};s.inlineLink={filter:function(e,r){return r.linkStyle==="inlined"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r){var t=r.getAttribute("href");t&&(t=t.replace(/([()])/g,"\\$1"));var n=h(r.getAttribute("title"));return n&&(n=' "'+n.replace(/"/g,'\\"')+'"'),"["+e+"]("+t+n+")"}};s.referenceLink={filter:function(e,r){return r.linkStyle==="referenced"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r,t){var n=r.getAttribute("href"),i=h(r.getAttribute("title"));i&&(i=' "'+i+'"');var a,f;switch(t.linkReferenceStyle){case"collapsed":a="["+e+"][]",f="["+e+"]: "+n+i;break;case"shortcut":a="["+e+"]",f="["+e+"]: "+n+i;break;default:var u=this.references.length+1;a="["+e+"]["+u+"]",f="["+u+"]: "+n+i}return this.references.push(f),a},references:[],append:function(e){var r="";return this.references.length&&(r=`

`+this.references.join(`
`)+`

`,this.references=[]),r}};s.emphasis={filter:["em","i"],replacement:function(e,r,t){return e.trim()?t.emDelimiter+e+t.emDelimiter:""}};s.strong={filter:["strong","b"],replacement:function(e,r,t){return e.trim()?t.strongDelimiter+e+t.strongDelimiter:""}};s.code={filter:function(e){var r=e.previousSibling||e.nextSibling,t=e.parentNode.nodeName==="PRE"&&!r;return e.nodeName==="CODE"&&!t},replacement:function(e){if(!e)return"";e=e.replace(/\r?\n|\r/g," ");for(var r=/^`|^ .*?[^ ].* $|`$/.test(e)?" ":"",t="`",n=e.match(/`+/gm)||[];n.indexOf(t)!==-1;)t=t+"`";return t+r+e+r+t}};s.image={filter:"img",replacement:function(e,r){var t=h(r.getAttribute("alt")),n=r.getAttribute("src")||"",i=h(r.getAttribute("title")),a=i?' "'+i+'"':"";return n?"!["+t+"]("+n+a+")":""}};function h(e){return e?e.replace(/(\n+\s*)+/g,`
`):""}function D(e){this.options=e,this._keep=[],this._remove=[],this.blankRule={replacement:e.blankReplacement},this.keepReplacement=e.keepReplacement,this.defaultRule={replacement:e.defaultReplacement},this.array=[];for(var r in e.rules)this.array.push(e.rules[r])}D.prototype={add:function(e,r){this.array.unshift(r)},keep:function(e){this._keep.unshift({filter:e,replacement:this.keepReplacement})},remove:function(e){this._remove.unshift({filter:e,replacement:function(){return""}})},forNode:function(e){if(e.isBlank)return this.blankRule;var r;return(r=m(this.array,e,this.options))||(r=m(this._keep,e,this.options))||(r=m(this._remove,e,this.options))?r:this.defaultRule},forEach:function(e){for(var r=0;r<this.array.length;r++)e(this.array[r],r)}};function m(e,r,t){for(var n=0;n<e.length;n++){var i=e[n];if(z(i,r,t))return i}}function z(e,r,t){var n=e.filter;if(typeof n=="string"){if(n===r.nodeName.toLowerCase())return!0}else if(Array.isArray(n)){if(n.indexOf(r.nodeName.toLowerCase())>-1)return!0}else if(typeof n=="function"){if(n.call(e,r,t))return!0}else throw new TypeError("`filter` needs to be a string, array, or function")}function Q(e){var r=e.element,t=e.isBlock,n=e.isVoid,i=e.isPre||function(x){return x.nodeName==="PRE"};if(!(!r.firstChild||i(r))){for(var a=null,f=!1,u=null,l=k(u,r,i);l!==r;){if(l.nodeType===3||l.nodeType===4){var o=l.data.replace(/[ \r\n\t]+/g," ");if((!a||/ $/.test(a.data))&&!f&&o[0]===" "&&(o=o.substr(1)),!o){l=d(l);continue}l.data=o,a=l}else if(l.nodeType===1)t(l)||l.nodeName==="BR"?(a&&(a.data=a.data.replace(/ $/,"")),a=null,f=!1):n(l)||i(l)?(a=null,f=!0):a&&(f=!1);else{l=d(l);continue}var c=k(u,l,i);u=l,l=c}a&&(a.data=a.data.replace(/ $/,""),a.data||d(a))}}function d(e){var r=e.nextSibling||e.parentNode;return e.parentNode.removeChild(e),r}function k(e,r,t){return e&&e.parentNode===r||t(r)?r.nextSibling||r.parentNode:r.firstChild||r.nextSibling||r.parentNode}var B=typeof window<"u"?window:{};function X(){var e=B.DOMParser,r=!1;try{new e().parseFromString("","text/html")&&(r=!0)}catch{}return r}function J(){var e=function(){};{var r=(T(),V(y));e.prototype.parseFromString=function(t){return r.createDocument(t)}}return e}var Z=X()?B.DOMParser:J();function ee(e,r){var t;if(typeof e=="string"){var n=re().parseFromString('<x-turndown id="turndown-root">'+e+"</x-turndown>","text/html");t=n.getElementById("turndown-root")}else t=e.cloneNode(!0);return Q({element:t,isBlock:A,isVoid:b,isPre:r.preformattedCode?te:null}),t}var v;function re(){return v=v||new Z,v}function te(e){return e.nodeName==="PRE"||e.nodeName==="CODE"}function ne(e,r){return e.isBlock=A(e),e.isCode=e.nodeName==="CODE"||e.parentNode.isCode,e.isBlank=ie(e),e.flankingWhitespace=ae(e,r),e}function ie(e){return!b(e)&&!j(e)&&/^\s*$/i.test(e.textContent)&&!Y(e)&&!q(e)}function ae(e,r){if(e.isBlock||r.preformattedCode&&e.isCode)return{leading:"",trailing:""};var t=le(e.textContent);return t.leadingAscii&&C("left",e,r)&&(t.leading=t.leadingNonAscii),t.trailingAscii&&C("right",e,r)&&(t.trailing=t.trailingNonAscii),{leading:t.leading,trailing:t.trailing}}function le(e){var r=e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);return{leading:r[1],leadingAscii:r[2],leadingNonAscii:r[3],trailing:r[4],trailingNonAscii:r[5],trailingAscii:r[6]}}function C(e,r,t){var n,i,a;return e==="left"?(n=r.previousSibling,i=/ $/):(n=r.nextSibling,i=/^ /),n&&(n.nodeType===3?a=i.test(n.nodeValue):t.preformattedCode&&n.nodeName==="CODE"?a=!1:n.nodeType===1&&!A(n)&&(a=i.test(n.textContent))),a}var se=Array.prototype.reduce,fe=[[/\\/g,"\\\\"],[/\*/g,"\\*"],[/^-/g,"\\-"],[/^\+ /g,"\\+ "],[/^(=+)/g,"\\$1"],[/^(#{1,6}) /g,"\\$1 "],[/`/g,"\\`"],[/^~~~/g,"\\~~~"],[/\[/g,"\\["],[/\]/g,"\\]"],[/^>/g,"\\>"],[/_/g,"\\_"],[/^(\d+)\. /g,"$1\\. "]];function p(e){if(!(this instanceof p))return new p(e);var r={rules:s,headingStyle:"setext",hr:"* * *",bulletListMarker:"*",codeBlockStyle:"indented",fence:"```",emDelimiter:"_",strongDelimiter:"**",linkStyle:"inlined",linkReferenceStyle:"full",br:"  ",preformattedCode:!1,blankReplacement:function(t,n){return n.isBlock?`

`:""},keepReplacement:function(t,n){return n.isBlock?`

`+n.outerHTML+`

`:n.outerHTML},defaultReplacement:function(t,n){return n.isBlock?`

`+t+`

`:t}};this.options=W({},r,e),this.rules=new D(this.options)}p.prototype={turndown:function(e){if(!ce(e))throw new TypeError(e+" is not a string, or an element/document/fragment node.");if(e==="")return"";var r=w.call(this,new ee(e,this.options));return ue.call(this,r)},use:function(e){if(Array.isArray(e))for(var r=0;r<e.length;r++)this.use(e[r]);else if(typeof e=="function")e(this);else throw new TypeError("plugin must be a Function or an Array of Functions");return this},addRule:function(e,r){return this.rules.add(e,r),this},keep:function(e){return this.rules.keep(e),this},remove:function(e){return this.rules.remove(e),this},escape:function(e){return fe.reduce(function(r,t){return r.replace(t[0],t[1])},e)}};function w(e){var r=this;return se.call(e.childNodes,function(t,n){n=new ne(n,r.options);var i="";return n.nodeType===3?i=n.isCode?n.nodeValue:r.escape(n.nodeValue):n.nodeType===1&&(i=oe.call(r,n)),P(t,i)},"")}function ue(e){var r=this;return this.rules.forEach(function(t){typeof t.append=="function"&&(e=P(e,t.append(r.options)))}),e.replace(/^[\t\r\n]+/,"").replace(/[\t\r\n\s]+$/,"")}function oe(e){var r=this.rules.forNode(e),t=w.call(this,e),n=e.flankingWhitespace;return(n.leading||n.trailing)&&(t=t.trim()),n.leading+r.replacement(t,e,this.options)+n.trailing}function P(e,r){var t=G(e),n=_(r),i=Math.max(e.length-t.length,r.length-n.length),a=`

`.substring(0,i);return t+a+n}function ce(e){return e!=null&&(typeof e=="string"||e.nodeType&&(e.nodeType===1||e.nodeType===9||e.nodeType===11))}var pe=p;export{pe as default};
//# sourceMappingURL=turndown.mjs.map