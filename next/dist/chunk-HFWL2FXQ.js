var o=new Set;function c(e){return o.add(e),()=>o.delete(e)}function d(e){for(let t of o)try{t(e)}catch(r){console.error(r)}}export{c as a,d as b};
