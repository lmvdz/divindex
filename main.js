/* Divindex landing — vanilla, no dependencies. */
(function () {
  "use strict";

  // Set this to a form endpoint (e.g. Formspree) to collect waitlist emails.
  // Left empty -> the form falls back to a mailto: link so nothing breaks.
  var FORM_ENDPOINT = "";
  var CONTACT = "hello@divindex.com";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------- Chart ---------------- */
  var wrap = document.getElementById("chart-wrap");

  function fmt(n) {
    if (n >= 1000) return Math.round(n).toLocaleString("en-US");
    if (n >= 100) return n.toFixed(1);
    return n.toFixed(2);
  }
  function signClass(v) { return v > 0 ? "up" : v < 0 ? "down" : ""; }
  function signStr(v) { return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; }

  function showError() {
    wrap.innerHTML =
      '<div class="chart-error"><span>Couldn’t load market data.</span>' +
      '<button class="btn btn-primary" id="chart-retry" type="button">Retry</button></div>';
    document.getElementById("chart-retry").addEventListener("click", load);
  }

  function renderQuote(hero) {
    document.getElementById("chart-title").textContent = hero.text;
    document.getElementById("chart-sub").textContent =
      "Priced in " + hero.unit + " · last " + hero.window + " days";
    document.getElementById("quote-value").textContent = fmt(hero.latest);
    var c = document.getElementById("quote-change");
    c.textContent = signStr(hero.changePct) + " · 7d";
    c.className = "quote-change " + signClass(hero.changePct);
  }

  function renderTicker(rows) {
    var ul = document.getElementById("ticker");
    ul.innerHTML = "";
    rows.forEach(function (r) {
      var li = document.createElement("li");
      var chg = document.createElement("span");
      chg.className = "tk-chg " + signClass(r.wkChange);
      chg.textContent = signStr(r.wkChange);
      li.innerHTML =
        '<span class="tk-name">' + r.text + "</span>" +
        '<span><span class="tk-price">' + fmt(r.price) + "</span></span>";
      li.querySelector("span:last-child").appendChild(chg);
      ul.appendChild(li);
    });
  }

  function renderChart(hero) {
    var pts = hero.series;
    if (!pts || pts.length < 2) { wrap.innerHTML = '<div class="chart-error">No data yet for this league.</div>'; return; }

    var W = 520, H = 168, padX = 6, padY = 16;
    var prices = pts.map(function (p) { return p.p; });
    var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
    var span = max - min || 1;
    var x = function (i) { return padX + (i / (pts.length - 1)) * (W - padX * 2); };
    var y = function (v) { return padY + (1 - (v - min) / span) * (H - padY * 2); };

    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.p).toFixed(1); }).join(" ");
    var area = line + " L" + x(pts.length - 1).toFixed(1) + " " + H + " L" + x(0).toFixed(1) + " " + H + " Z";
    var last = pts.length - 1;

    var summary = hero.text + " is " + fmt(hero.latest) + " " + hero.unit +
      ", " + signStr(hero.changePct) + " over " + hero.window + " days.";

    wrap.innerHTML =
      '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + summary + '">' +
        '<defs><linearGradient id="divArea" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#f0c069" stop-opacity="0.28"/>' +
          '<stop offset="100%" stop-color="#f0c069" stop-opacity="0"/>' +
        "</linearGradient></defs>" +
        '<path class="chart-area" d="' + area + '"/>' +
        '<path class="chart-line" d="' + line + '" id="cline"/>' +
        '<line class="chart-hover-line" id="hline" x1="0" y1="0" x2="0" y2="' + H + '" style="opacity:0"/>' +
        '<circle class="chart-dot" id="hdot" r="4" style="opacity:0"/>' +
        '<circle class="chart-dot" cx="' + x(last).toFixed(1) + '" cy="' + y(pts[last].p).toFixed(1) + '" r="4.5"/>' +
      "</svg>" +
      '<div class="chart-tip" id="tip"></div>';

    if (!reduceMotion) {
      var path = document.getElementById("cline");
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();
      path.style.transition = "stroke-dashoffset .9s ease";
      path.style.strokeDashoffset = 0;
    }

    // hover tooltip
    var svg = wrap.querySelector(".chart-svg");
    var tip = document.getElementById("tip");
    var hline = document.getElementById("hline");
    var hdot = document.getElementById("hdot");
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect();
      var rel = (e.clientX - rect.left) / rect.width;
      var i = Math.max(0, Math.min(pts.length - 1, Math.round(rel * (pts.length - 1))));
      var px = x(i), py = y(pts[i].p);
      hline.setAttribute("x1", px); hline.setAttribute("x2", px); hline.style.opacity = 1;
      hdot.setAttribute("cx", px); hdot.setAttribute("cy", py); hdot.style.opacity = 1;
      tip.style.left = (px / W * rect.width) + "px";
      tip.style.top = (py / H * rect.height) + "px";
      tip.innerHTML = fmt(pts[i].p) + " · <span style='color:#99a2b8'>" + pts[i].t.slice(5) + "</span>";
      tip.style.opacity = 1;
    });
    svg.addEventListener("pointerleave", function () {
      tip.style.opacity = 0; hline.style.opacity = 0; hdot.style.opacity = 0;
    });
  }

  function load() {
    wrap.innerHTML = '<div class="chart-skeleton" aria-hidden="true"></div>';
    fetch("./data/series.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        renderQuote(d.hero);
        renderChart(d.hero);
        renderTicker(d.ticker || []);
        var foot = document.getElementById("card-foot");
        if (foot) foot.textContent = d.note + " As of " + d.asOf + " · " + d.league + ".";
      })
      .catch(showError);
  }
  load();

  /* ---------------- Waitlist forms ---------------- */
  function wireForm(formId, inputId, msgId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var input = document.getElementById(inputId);
    var msg = document.getElementById(msgId);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "form-msg";
      var email = input.value.trim();
      if (!input.checkValidity() || !email) {
        msg.textContent = "Enter a valid email address.";
        msg.classList.add("err"); input.focus(); return;
      }
      var btn = form.querySelector("button");

      if (!FORM_ENDPOINT) {
        // No backend wired yet — fall back to email, honestly.
        msg.innerHTML = 'Thanks! Email <a href="mailto:' + CONTACT + '?subject=Divindex%20early%20access" style="color:#6fcad8">' + CONTACT + '</a> to lock your spot.';
        msg.classList.add("ok");
        return;
      }

      btn.disabled = true; msg.textContent = "Adding you…";
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email })
      })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r; })
        .then(function () {
          form.reset();
          msg.textContent = "You're on the list. See you next league.";
          msg.classList.add("ok");
        })
        .catch(function () {
          msg.innerHTML = 'Something broke — email <a href="mailto:' + CONTACT + '" style="color:#6fcad8">' + CONTACT + '</a> instead.';
          msg.classList.add("err");
        })
        .finally(function () { btn.disabled = false; });
    });
  }
  wireForm("cta-hero", "email-hero", "msg-hero");
  wireForm("cta-foot", "email-foot", "msg-foot");
})();
