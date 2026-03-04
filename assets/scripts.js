// For Quiz Pages
document.addEventListener('DOMContentLoaded', function () {
  const observer = new MutationObserver(() => {
    const shadowHost = document.querySelector('#perfect-product-finder');
    if (!shadowHost || !shadowHost.shadowRoot) return;

    // Prevent injecting more than once
    if (shadowHost.shadowRoot.querySelector('#injected-style')) return;

    const style = document.createElement('style');
    style.id = 'injected-style';
    style.textContent = `
      .progress-percentage {
        white-space: nowrap;
        display: inline-block;
        font-size: 14px;
      }
    `;
    shadowHost.shadowRoot.appendChild(style);
  });

  observer.observe(document.body, { childList: true, subtree: true });
});


// recharge.js
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var el = document.getElementById('recharge-styling');
    if (!el) return;
    var type = (el.getAttribute('data-recharge-type') || '').trim().toLowerCase();
    console.log('[recharge] detected type =', type);
    var cssToInject = COMMON_CSS + (type === 'bottles' ? BOTTLES_SELECT_CSS : FILTERS_SELECT_CSS);
    injectGlobalCSS(cssToInject);
    var SVG_CSS = type === 'bottles' ? BOTTLES_SVG_CSS : FILTERS_SVG_CSS;
    initWidget(SVG_CSS);
  });

  function injectGlobalCSS(cssText) {
    var s = document.createElement('style');
    s.textContent = cssText;
    document.head.appendChild(s);
  }

  function initWidget(svgCss) {
    var W = document.querySelector('recharge-subscription-widget');
    if (!W || !W.shadowRoot) return;

    var SVG_ID = 'svgBulletOverride';
    var benefitsEl = W.shadowRoot.querySelector('rc-benefits');
    var benefitsSR = benefitsEl && benefitsEl.shadowRoot;
    if (benefitsSR && !benefitsSR.getElementById(SVG_ID)) {
      var style = document.createElement('style');
      style.id = SVG_ID;
      style.textContent = svgCss;
      benefitsSR.appendChild(style);
    }

    var plansEl = W.shadowRoot.querySelector('rc-selling-plans');
    var plansSR = plansEl && plansEl.shadowRoot;
    if (plansSR && !plansSR.querySelector('.custom-label')) {
      var lbl = plansSR.querySelector('label.rc-plans-dropdown');
      if (lbl) {
        var note = document.createElement('span');
        note.className = 'custom-label';
        note.innerHTML = '<em>Subscription discounts cannot be stacked with other discount codes.</em>';
        Object.assign(note.style, {
          color:    '#6b7280',
          display:  'flex',
          fontSize: '11.5px',
          margin:   '3px 0 0 3px'
        });
        lbl.insertAdjacentElement('afterend', note);
      }
    }

    ['recharge:widget:loaded', 'recharge:widget:updated'].forEach(function(evt){
      W.addEventListener(evt, function(){ initWidget(svgCss); });
    });

    W.addEventListener('click', function(e){
      if (e.composedPath().some(function(el){
        return el.tagName === 'INPUT' && el.value === 'subscription';
      })) {
        setTimeout(function(){ initWidget(svgCss); }, 0);
      }
    });

    new MutationObserver(function(records){
      if (records.some(function(r){
        return Array.from(r.addedNodes).some(function(n){
          return n.tagName === 'RC-BENEFITS';
        });
      })) {
        initWidget(svgCss);
      }
    }).observe(W.shadowRoot, { childList: true, subtree: true });
  }

  var COMMON_CSS = `
::part(rc-purchase-option) {
  background: #FFF;
  margin-bottom: 16px;
}
::part(rc-purchase-option__selector),
::part(rc-purchase-option__prices) {
  padding: 0;
  transform: translateY(2px);
  line-height: .75;
}
::part(rc-purchase-option__label) {
  padding: 16px 15px;
}
::part(rc-purchase-option__checked-indicator),
::part(rc-learn-more__trigger-compact) {
  transform: translateY(-2px);
  margin-left:-5px;
}

::part(rc-learn-more) {
  margin-left:0.3rem;
}

::part(rc-purchase-option__prices) {
  flex-direction: row;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left:0;
  justify-content:flex-end;
  flex-wrap:wrap;
}
::part(rc-purchase-option__discounted-price),
::part(rc-purchase-option__price) {
  font-size: 15.5px;
}
::part(rc-purchase-option__original-price) {
  font-size: 13px;
  color: #828282;
}
::part(rc-purchase-option__badge) {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding-top: 5px;
  padding-bottom: 3px;
}
::part(rc-plans-select):focus-visible {
  box-shadow: none;
}
::part(rc-benefits__list) {
  background: #fdfcf9;
  padding: 16px;
  margin-bottom: 0;
  border-radius: 8px;
  border: 1px solid #f0f2f5;
}
::part(rc-purchase-option__sub-container .compact p) {
  display: none;
}
::part(rc-purchase-option__sub-container) {
  gap: 12px;
}
::part(rc-benefits__list_p) {
  display: none;
}
::part(rc-purchase-option__selector) {
  font-size: 18px;
}
::part(rc-purchase-option__subscription) {
  margin-bottom: 0 !important;
}
::part(rc-plans-select) {
  padding:12px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14.25px;
}
`;

  var BOTTLES_SELECT_CSS = `
`;

  var FILTERS_SELECT_CSS = `

`;

  var BOTTLES_SVG_CSS = `
div.rc-benefits__list > p:first-of-type {
  font-size: 13.5px;
  letter-spacing: .88px;
  font-weight: 600;
  margin-bottom: 16px;
  margin-top: 0;
}
div.rc-benefits__list ul {
  padding-left: 10px;
}
div.rc-benefits__list ul > li {
  padding-left: 31px;
  padding-bottom:12px;
}
div.rc-benefits__list ul > li p {
  margin-bottom: 15px;
}
div.rc-benefits__list ul > li:last-of-type p {
  margin-bottom: 0;
}
div.rc-benefits__list ul > li::before {
  display: inline-block !important;
  width: 20px !important;
  height: 20px !important;
  margin-right: 8px !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  background-color: transparent !important;
  opacity: .7;
  top: -1.1px;
}
div.rc-benefits__list ul > li:nth-child(1)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000' viewBox='0 0 256 256'><path d='M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(2)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M184,24H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64V40A16,16,0,0,0,184,24Zm0,16V56H72V40Zm0,176H72V180l56-42,56,42.35Zm-56-98L72,76V72H184v3.64Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(3)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(4)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M236,69.4A16.13,16.13,0,0,0,223.92,64H176a48,48,0,0,0-96,0H32.08a16.13,16.13,0,0,0-12,5.4,16,16,0,0,0-3.92,12.48l14.26,120a16,16,0,0,0,16,14.12H209.67a16,16,0,0,0,16-14.12l14.26-120A16,16,0,0,0,236,69.4ZM128,32a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm81.76,168a.13.13,0,0,1-.09,0H46.25L32.08,80H80v24a8,8,0,0,0,16,0V80h64v24a8,8,0,0,0,16,0V80h48Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(5)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm40-68a28,28,0,0,1-28,28h-4v8a8,8,0,0,1,16,0v-8H104a8,8,0,0,1,0-16h36a12,12,0,0,0,0-24H116a28,28,0,0,1,0-56h4V72a8,8,0,0,1,16,0v8h16a8,8,0,0,1,0,16H116a12,12,0,0,0,0,24h24A28,28,0,0,1,168,148Z'/></svg>");
}
`;

  var FILTERS_SVG_CSS = `
div.rc-benefits__list > p:first-of-type {
  font-size: 13.5px;
  letter-spacing: .88px;
  font-weight: 600;
  margin-bottom: 16px;
  margin-top: 0;
}
div.rc-benefits__list ul {
  padding-left: 10px;
}
div.rc-benefits__list ul > li {
  padding-left: 31px;
}
div.rc-benefits__list ul > li p {
  margin-bottom: 15px;
}
div.rc-benefits__list ul > li:last-of-type p {
  margin-bottom: 0;
}
div.rc-benefits__list ul > li::before {
  display: inline-block !important;
  width: 20px !important;
  height: 20px !important;
  margin-right: 8px !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  background-color: transparent !important;
  opacity: .7;
  top: -1.1px;
}
div.rc-benefits__list ul > li:nth-child(1)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000' viewBox='0 0 256 256'><path d='M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(2)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M184,24H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64V40A16,16,0,0,0,184,24Zm0,16V56H72V40Zm0,176H72V180l56-42,56,42.35Zm-56-98L72,76V72H184v3.64Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(3)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z'/></svg>");
}
div.rc-benefits__list ul > li:nth-child(4)::before {
  content: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%23000000' viewBox='0 0 256 256'><path d='M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm40-68a28,28,0,0,1-28,28h-4v8a8,8,0,0,1,16,0v-8H104a8,8,0,0,1,0-16h36a12,12,0,0,0,0-24H116a28,28,0,0,1,0-56h4V72a8,8,0,0,1,16,0v8h16a8,8,0,0,1,0,16H116a12,12,0,0,0,0,24h24A28,28,0,0,1,168,148Z'/></svg>");
}
`;

})();
