<script>
  let { score, size = 48 } = $props();

  let numScore = $derived(parseFloat(score) || 0);
  let color = $derived(
    numScore >= 4.0 ? 'var(--score-high)' :
    numScore >= 3.0 ? 'var(--score-mid)' :
    numScore > 0 ? 'var(--score-low)' :
    'var(--score-skip)'
  );
  let pct = $derived(numScore / 5 * 100);
  let radius = $derived(size / 2 - 4);
  let circumference = $derived(2 * Math.PI * radius);
  let offset = $derived(circumference - (pct / 100) * circumference);
</script>

<div class="score-ring" style="width:{size}px;height:{size}px">
  <svg viewBox="0 0 {size} {size}">
    <circle
      cx={size/2} cy={size/2} r={radius}
      fill="none" stroke="var(--border)" stroke-width="3"
    />
    <circle
      cx={size/2} cy={size/2} r={radius}
      fill="none" stroke={color} stroke-width="3"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      stroke-linecap="round"
      transform="rotate(-90 {size/2} {size/2})"
    />
  </svg>
  <span class="score-text" style="color:{color};font-size:{size * 0.3}px">
    {numScore.toFixed(1)}
  </span>
</div>

<style>
  .score-ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    position: absolute;
    top: 0;
    left: 0;
  }
  .score-text {
    font-weight: 700;
    z-index: 1;
  }
</style>
