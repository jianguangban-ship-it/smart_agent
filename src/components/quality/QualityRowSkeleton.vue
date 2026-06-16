<template>
  <!-- v10.184: shimmer placeholder shown in the grid body during the initial
       fetch. Mirrors QualityRow's grid template byte-for-byte so the sticky
       header columns line up and the swap to real rows doesn't shift layout. -->
  <div class="skeleton-row" aria-hidden="true">
    <div class="sk-cell"><span class="sk-block" style="width: 55%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 70%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 60%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 45%"></span></div>
    <div class="sk-cell sk-cell--summary"><span class="sk-block" style="width: 85%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 50%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 30%"></span></div>
    <div class="sk-cell"><span class="sk-block" style="width: 65%"></span></div>
  </div>
</template>

<style scoped>
.skeleton-row {
  display: grid;
  grid-template-columns: 200px 200px 200px 200px 1fr 200px 200px 200px;
  border-bottom: 1px solid var(--border-color);
}
.sk-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  min-height: 42px;
}
.sk-cell--summary {
  justify-content: flex-start;
}
.sk-block {
  display: inline-block;
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--border-color) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
}
@keyframes sk-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sk-block { animation: none; }
}
</style>
