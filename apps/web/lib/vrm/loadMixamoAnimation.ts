import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'

/**
 * Mixamo rig 骨骼名稱 → VRM Humanoid 骨骼名稱
 * 來源：https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/humanoidAnimation/mixamoVRMRigMap.js
 */
const mixamoVRMRigMap: Record<string, string> = {
  mixamorigHips:             'hips',
  mixamorigSpine:            'spine',
  mixamorigSpine1:           'chest',
  mixamorigSpine2:           'upperChest',
  mixamorigNeck:             'neck',
  mixamorigHead:             'head',
  mixamorigLeftShoulder:     'leftShoulder',
  mixamorigLeftArm:          'leftUpperArm',
  mixamorigLeftForeArm:      'leftLowerArm',
  mixamorigLeftHand:         'leftHand',
  mixamorigLeftHandThumb1:   'leftThumbMetacarpal',
  mixamorigLeftHandThumb2:   'leftThumbProximal',
  mixamorigLeftHandThumb3:   'leftThumbDistal',
  mixamorigLeftHandIndex1:   'leftIndexProximal',
  mixamorigLeftHandIndex2:   'leftIndexIntermediate',
  mixamorigLeftHandIndex3:   'leftIndexDistal',
  mixamorigLeftHandMiddle1:  'leftMiddleProximal',
  mixamorigLeftHandMiddle2:  'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3:  'leftMiddleDistal',
  mixamorigLeftHandRing1:    'leftRingProximal',
  mixamorigLeftHandRing2:    'leftRingIntermediate',
  mixamorigLeftHandRing3:    'leftRingDistal',
  mixamorigLeftHandPinky1:   'leftLittleProximal',
  mixamorigLeftHandPinky2:   'leftLittleIntermediate',
  mixamorigLeftHandPinky3:   'leftLittleDistal',
  mixamorigRightShoulder:    'rightShoulder',
  mixamorigRightArm:         'rightUpperArm',
  mixamorigRightForeArm:     'rightLowerArm',
  mixamorigRightHand:        'rightHand',
  mixamorigRightHandPinky1:  'rightLittleProximal',
  mixamorigRightHandPinky2:  'rightLittleIntermediate',
  mixamorigRightHandPinky3:  'rightLittleDistal',
  mixamorigRightHandRing1:   'rightRingProximal',
  mixamorigRightHandRing2:   'rightRingIntermediate',
  mixamorigRightHandRing3:   'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1:  'rightIndexProximal',
  mixamorigRightHandIndex2:  'rightIndexIntermediate',
  mixamorigRightHandIndex3:  'rightIndexDistal',
  mixamorigRightHandThumb1:  'rightThumbMetacarpal',
  mixamorigRightHandThumb2:  'rightThumbProximal',
  mixamorigRightHandThumb3:  'rightThumbDistal',
  mixamorigLeftUpLeg:        'leftUpperLeg',
  mixamorigLeftLeg:          'leftLowerLeg',
  mixamorigLeftFoot:         'leftFoot',
  mixamorigLeftToeBase:      'leftToes',
  mixamorigRightUpLeg:       'rightUpperLeg',
  mixamorigRightLeg:         'rightLowerLeg',
  mixamorigRightFoot:        'rightFoot',
  mixamorigRightToeBase:     'rightToes',
}

/**
 * 將已載入的 Mixamo FBX asset 轉換為 VRM 可用的 AnimationClip。
 *
 * 實作邏輯來自 three-vrm 官方範例：
 * https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/humanoidAnimation/loadMixamoAnimation.js
 *
 * 關鍵修正（比舊版 retargetMixamoClip 多做的事）：
 *   1. 正確修正旋轉：parentRestWorldRotation × trackRotation × restRotationInverse
 *   2. 支援 VRM 0.x 座標系翻轉
 *   3. 支援 hips 位移軌跡（VectorKeyframeTrack）並做高度縮放
 *
 * @param asset  fbxLoader.loadAsync() 回傳的 THREE.Group
 * @param vrm    已載入的 VRM 實例
 */
export function retargetMixamoAnimation(asset: THREE.Group, vrm: VRM): THREE.AnimationClip {
  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com')
    ?? asset.animations[0]

  if (!clip) return new THREE.AnimationClip('vrmAnimation', 0, [])

  const tracks: THREE.KeyframeTrack[] = []

  const restRotationInverse = new THREE.Quaternion()
  const parentRestWorldRotation = new THREE.Quaternion()
  const _quatA = new THREE.Quaternion()

  // hips 高度縮放：讓動畫高度跟 VRM 身高匹配
  const motionHipsNode = asset.getObjectByName('mixamorigHips')
  const vrmHipsPos = vrm.humanoid.normalizedRestPose.hips?.position
  const hipsPositionScale =
    motionHipsNode && vrmHipsPos
      ? vrmHipsPos[1] / motionHipsNode.position.y
      : 1

  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split('.')
    const mixamoRigName = trackSplitted[0]
    if (!mixamoRigName) return
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName]
    const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName as never)?.name
    const mixamoRigNode = asset.getObjectByName(mixamoRigName)

    if (vrmNodeName == null || !mixamoRigNode) return

    const propertyName = trackSplitted[1]

    // レスト姿勢のワールド回転を記録
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
    mixamoRigNode.parent?.getWorldQuaternion(parentRestWorldRotation)

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4)
        _quatA.fromArray(flatQuaternion)

        // 親のレスト回転 × トラック回転 × レスト回転の逆
        _quatA
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse)

        _quatA.toArray(flatQuaternion)
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v
        })
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times,
          // VRM 0.x：X / Z 分量需要翻轉（座標系差異）
          track.values.map((v, i) =>
            vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v
          ),
        ),
      )
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      const value = track.values.map((v, i) =>
        (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale
      )
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value))
    }
  })

  return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks)
}
