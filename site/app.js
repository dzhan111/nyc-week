// Client-side filtering and "today" labelling.
//
// The relative day labels are computed here rather than at build time on
// purpose: the site is rebuilt once a week, so a baked-in "Today" would be
// wrong from the second day onward.

(function () {
  "use strict";

  var events = Array.prototype.slice.call(document.querySelectorAll(".event"));
  if (!events.length) return;

  var state = { category: "all", free: false, freefood: false, borough: "all" };

  // ------------------------------------------------------------- day labels

  function todayISO() {
    // Anchor to America/New_York regardless of the reader's device timezone —
    // a Londoner opening this at 2am should still see NYC's "today".
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function markDays() {
    var today = todayISO();
    var days = document.querySelectorAll(".day");
    for (var i = 0; i < days.length; i++) {
      var el = days[i];
      var date = el.getAttribute("data-day");
      var rel = el.querySelector(".day-relative");
      var link = document.querySelector('[data-daylink="' + date + '"]');

      if (date < today) {
        el.classList.add("is-past");
        if (link) link.classList.add("is-past");
      } else if (date === today) {
        if (rel) rel.textContent = "Today";
        if (link) link.classList.add("is-today");
      } else if (isNextDay(today, date)) {
        if (rel) rel.textContent = "Tomorrow";
      }
    }
  }

  function isNextDay(todayStr, otherStr) {
    var t = Date.parse(todayStr + "T00:00:00Z");
    var o = Date.parse(otherStr + "T00:00:00Z");
    return o - t === 86400000;
  }

  // ---------------------------------------------------------------- filters

  function matches(ev) {
    if (state.category !== "all" && ev.getAttribute("data-category") !== state.category) return false;
    if (state.free && ev.getAttribute("data-free") !== "1") return false;
    if (state.freefood && ev.getAttribute("data-freefood") !== "1") return false;
    if (state.borough !== "all" && ev.getAttribute("data-borough") !== state.borough) return false;
    return true;
  }

  function apply() {
    var shown = 0;

    for (var i = 0; i < events.length; i++) {
      var ok = matches(events[i]);
      events[i].hidden = !ok;
      if (ok) shown++;
    }

    // Hide category groups and day sections that emptied out, so the page never
    // shows a heading with nothing under it.
    hideEmpty(".category");
    hideEmpty(".day");

    var days = document.querySelectorAll(".day");
    for (var d = 0; d < days.length; d++) {
      var link = document.querySelector('[data-daylink="' + days[d].getAttribute("data-day") + '"]');
      if (link) link.classList.toggle("is-empty", days[d].hidden);
    }

    var counter = document.querySelector(".count-live");
    if (counter) counter.textContent = String(shown);

    var empty = document.querySelector(".no-results");
    if (empty) empty.hidden = shown !== 0;
  }

  function hideEmpty(selector) {
    var groups = document.querySelectorAll(selector);
    for (var i = 0; i < groups.length; i++) {
      var visible = groups[i].querySelectorAll(".event:not([hidden])").length;
      groups[i].hidden = visible === 0;
    }
  }

  // ----------------------------------------------------------------- wiring

  var chips = document.querySelectorAll(".chip[data-filter='category']");
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function () {
      state.category = this.getAttribute("data-value");
      for (var j = 0; j < chips.length; j++) chips[j].classList.toggle("is-on", chips[j] === this);
      apply();
    });
  }

  var freeBox = document.getElementById("only-free");
  if (freeBox) freeBox.addEventListener("change", function () { state.free = this.checked; apply(); });

  var foodBox = document.getElementById("only-freefood");
  if (foodBox) foodBox.addEventListener("change", function () { state.freefood = this.checked; apply(); });

  var boroughSel = document.getElementById("borough");
  if (boroughSel) boroughSel.addEventListener("change", function () { state.borough = this.value; apply(); });

  markDays();
  apply();

  // Land on today's section when arriving without an explicit anchor, so a
  // mid-week visit doesn't open on days that have already passed.
  if (!location.hash) {
    var todaySection = document.querySelector('.day[data-day="' + todayISO() + '"]');
    if (todaySection && !todaySection.hidden) {
      todaySection.scrollIntoView({ block: "start" });
    }
  }
})();
