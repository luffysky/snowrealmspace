declare module 'lottie-web/build/player/lottie_light' {
  import type { AnimationConfigWithData, AnimationItem } from 'lottie-web'
  const lottie: {
    loadAnimation(params: AnimationConfigWithData): AnimationItem
  }
  export default lottie
}
