if (typeof document !== 'undefined' && !document.queryCommandSupported) {
  document.queryCommandSupported = () => false
}
