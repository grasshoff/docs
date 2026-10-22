// famulus-visualization — D3 chart components in the famulus look.
//
//   import { barChart } from './d3/charts.js';
//   barChart(document.querySelector('#fig'), { labels, values, highlight: 1, ylabel: 'radius (mm)' });
//
// Every component takes real data arrays and the claim the figure carries:
// `highlight` / `emphasis` draw the element the narrative is about in gold-deep,
// everything else is context. `animate: true` draws the marks in with the
// motion tokens (one change per step, slow enough to follow).
// Requires the global d3 (vendor/d3.v7.min.js) and famulus-tokens.css.

import { tokens, color, categorical } from '../famulus-tokens.js';

const d3 = window.d3;
const M = { top: 28, right: 24, bottom: 44, left: 56 };

function frame(el, { width = 640, height = 360, title, xlabel, ylabel, margin = M } = {}) {
  el.innerHTML = '';
  const svg = d3.select(el).append('svg')
    .attr('class', 'fv-chart').attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img').attr('aria-label', title || xlabel || 'chart');
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  if (title) svg.append('text').attr('class', 'fv-title').attr('x', margin.left).attr('y', 18).text(title);
  if (xlabel) svg.append('text').attr('class', 'fv-axis-label').attr('text-anchor', 'middle')
    .attr('x', margin.left + iw / 2).attr('y', height - 6).text(xlabel);
  if (ylabel) svg.append('text').attr('class', 'fv-axis-label').attr('text-anchor', 'middle')
    .attr('transform', `translate(14,${margin.top + ih / 2}) rotate(-90)`).text(ylabel);
  return { svg, g, iw, ih };
}

function axes(g, x, y, iw, ih, { xTicks, yTicks = 6, xFormat, yFormat } = {}) {
  g.append('g').attr('class', 'fv-grid').call(d3.axisLeft(y).ticks(yTicks).tickSize(-iw).tickFormat(''));
  const xa = d3.axisBottom(x);
  if (xTicks !== undefined && x.ticks) xa.ticks(xTicks);
  if (xFormat) xa.tickFormat(xFormat);
  g.append('g').attr('class', 'fv-axis').attr('transform', `translate(0,${ih})`).call(xa);
  const ya = d3.axisLeft(y).ticks(yTicks);
  if (yFormat) ya.tickFormat(yFormat);
  g.append('g').attr('class', 'fv-axis').call(ya);
}

const check = (name, a, b) => {
  if (a.length !== b.length) throw new Error(`famulus-viz ${name}: ${a.length} x values but ${b.length} y values`);
};
const ms = () => tokens.motion.step_ms;
// Motion is off for readers who ask for reduced motion, and for still captures (?static).
export const motionAllowed = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('static');
const markColor = (i, hl) => (hl === undefined || hl === null ? categorical()[i % categorical().length]
  : i === hl ? color('gold_deep') : tokens.ramp.context);

// Bars start at zero.
export function barChart(el, { labels, values, highlight = null, animate = false, ...opts }) {
  check('barChart', labels, values);
  const { g, iw, ih } = frame(el, opts);
  const hl = highlight === null ? [] : [].concat(highlight);
  const x = d3.scaleBand().domain(labels).range([0, iw]).padding(0.22);
  const y = d3.scaleLinear().domain([0, d3.max(values) * 1.08]).nice().range([ih, 0]);
  axes(g, x, y, iw, ih, opts);
  const bars = g.selectAll('rect.fv-bar').data(values).join('rect').attr('class', 'fv-bar')
    .attr('x', (_, i) => x(labels[i])).attr('width', x.bandwidth())
    .attr('fill', (_, i) => (hl.length === 0 ? color('oxford') : hl.includes(i) ? color('gold_deep') : tokens.ramp.context));
  if (animate && motionAllowed()) {
    bars.attr('y', ih).attr('height', 0).transition().delay((_, i) => i * ms() / 4).duration(ms())
      .ease(d3.easeCubicInOut).attr('y', d => y(d)).attr('height', d => ih - y(d));
  } else {
    bars.attr('y', d => y(d)).attr('height', d => ih - y(d));
  }
  return { x, y };
}

// Line chart; series = [{label, y}], highlight = index of the series the claim is about.
export function lineChart(el, { x: xs, series, highlight = null, animate = false, reference = null, ...opts }) {
  series.forEach(s => check('lineChart', xs, s.y));
  const { g, iw, ih } = frame(el, opts);
  const all = series.flatMap(s => s.y).concat(reference ? [reference.value] : []);
  const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, iw]);
  const y = d3.scaleLinear().domain(d3.extent(all)).nice().range([ih, 0]);
  axes(g, x, y, iw, ih, opts);
  if (reference) {
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(reference.value)).attr('y2', y(reference.value))
      .attr('stroke', color('ink')).attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
    g.append('text').attr('class', 'fv-annotation').attr('x', iw).attr('y', y(reference.value) - 5)
      .attr('text-anchor', 'end').text(reference.label);
  }
  const line = d3.line().x((_, i) => x(xs[i])).y(d => y(d));
  series.forEach((s, i) => {
    const path = g.append('path').datum(s.y).attr('fill', 'none').attr('stroke', markColor(i, highlight))
      .attr('stroke-width', highlight === i ? tokens.stroke_px.accent : tokens.stroke_px.line).attr('d', line);
    if (animate && motionAllowed()) {
      const len = path.node().getTotalLength();
      path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().delay(i * ms()).duration(ms() * 2).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
    }
    if (s.label && series.length > 1) {
      g.append('text').attr('class', 'fv-legend').attr('x', x(xs[xs.length - 1]) + 4).attr('y', y(s.y[s.y.length - 1]))
        .attr('dominant-baseline', 'middle').attr('fill', markColor(i, highlight)).text(s.label);
    }
  });
  return { x, y };
}

// Estimate with its confidence band.
export function ciChart(el, { x: xs, y: ys, lo, hi, label = null, bandLabel = '95 % CI', ...opts }) {
  check('ciChart', xs, ys); check('ciChart lo', xs, lo); check('ciChart hi', xs, hi);
  const { g, iw, ih } = frame(el, opts);
  const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, iw]);
  const y = d3.scaleLinear().domain([d3.min(lo), d3.max(hi)]).nice().range([ih, 0]);
  axes(g, x, y, iw, ih, opts);
  g.append('path').datum(xs.map((v, i) => [v, lo[i], hi[i]])).attr('fill', color('oxford_100'))
    .attr('d', d3.area().x(d => x(d[0])).y0(d => y(d[1])).y1(d => y(d[2])));
  g.append('path').datum(ys).attr('fill', 'none').attr('stroke', color('oxford')).attr('stroke-width', tokens.stroke_px.line)
    .attr('d', d3.line().x((_, i) => x(xs[i])).y(d => y(d)));
  g.append('text').attr('class', 'fv-legend').attr('x', 4).attr('y', 10).text(label ? `${label} · ${bandLabel}` : bandLabel);
  return { x, y };
}

// Residuals, optionally with per-point CI half-widths, and a threshold band
// (the measurement check of viewer_3dmesh.html in ai-sundial3d).
export function residualChart(el, { ids, residuals, ci = null, threshold = null, animate = false, ...opts }) {
  check('residualChart', ids, residuals); if (ci) check('residualChart ci', ids, ci);
  const { g, iw, ih } = frame(el, opts);
  const x = d3.scalePoint().domain(ids.map(String)).range([0, iw]).padding(0.5);
  const half = (i) => (ci ? ci[i] : 0);
  const ext = d3.max(residuals.map((r, i) => Math.abs(r) + half(i)).concat(threshold ? [threshold] : []));
  const y = d3.scaleLinear().domain([-ext * 1.08, ext * 1.08]).nice().range([ih, 0]);  // headroom: no point on the frame
  axes(g, x, y, iw, ih, opts);
  g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', color('ink'));
  if (threshold) {
    [threshold, -threshold].forEach(t => g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(t)).attr('y2', y(t))
      .attr('stroke', color('gold_deep')).attr('stroke-dasharray', '5 4'));
  }
  // gold marks the points the claim is about: beyond the threshold when one is given, else beyond their own CI
  const pts = ids.map((id, i) => ({ id: String(id), r: residuals[i], c: half(i),
    out: threshold ? Math.abs(residuals[i]) > threshold : ci ? Math.abs(residuals[i]) > ci[i] : false }));
  const grp = g.selectAll('g.fv-res').data(pts).join('g').attr('class', 'fv-res');
  grp.filter(d => d.c > 0).append('line').attr('x1', d => x(d.id)).attr('x2', d => x(d.id))
    .attr('y1', d => y(d.r - d.c)).attr('y2', d => y(d.r + d.c)).attr('stroke', color('oxford'));
  const dots = grp.append('circle').attr('cx', d => x(d.id)).attr('r', d => (d.out ? 5 : 4))
    .attr('fill', d => (d.out ? color('gold_deep') : color('oxford')));
  if (animate && motionAllowed()) {
    dots.attr('cy', y(0)).transition().delay((_, i) => i * ms() / 3).duration(ms()).ease(d3.easeCubicInOut).attr('cy', d => y(d.r));
  } else {
    dots.attr('cy', d => y(d.r));
  }
  return { x, y };
}

// Scatter; emphasis = array of booleans for the points the claim is about.
export function scatterChart(el, { x: xs, y: ys, emphasis = null, labels = null, ...opts }) {
  check('scatterChart', xs, ys);
  const { g, iw, ih } = frame(el, opts);
  const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([0, iw]);
  const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([ih, 0]);
  axes(g, x, y, iw, ih, opts);
  g.selectAll('circle').data(xs).join('circle').attr('cx', d => x(d)).attr('cy', (_, i) => y(ys[i]))
    .attr('r', (_, i) => (emphasis && emphasis[i] ? 5.5 : 4))
    .attr('fill', (_, i) => (!emphasis ? color('oxford') : emphasis[i] ? color('gold_deep') : tokens.ramp.context));
  if (labels) {
    g.selectAll('text.fv-point-label').data(xs).join('text').attr('class', 'fv-annotation')
      .attr('x', d => x(d) + 7).attr('y', (_, i) => y(ys[i]) - 6).text((_, i) => labels[i]);
  }
  return { x, y };
}
