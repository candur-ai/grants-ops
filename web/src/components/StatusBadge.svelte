<script>
  let { status } = $props();

  const colorMap = {
    'Discovered': 'info',
    'Evaluated': 'info',
    'Preparing': 'warning',
    'Applied': 'success',
    'Under Review': 'warning',
    'Awarded': 'success',
    'Not Funded': 'danger',
    'Withdrawn': 'neutral',
    'SKIP': 'neutral',
  };

  let color = $derived(colorMap[status] || 'neutral');
</script>

<span class="badge badge-{color}">{status}</span>
