var o=new Set;function n(e){return o.add(e),()=>o.delete(e)}function c(e){for(let t of o)try{t(e)}catch(r){console.error(r)}}export{n as a,c as b};
