import './style.css'
import QrScanner from 'qr-scanner'

class QRScannerApp {
  private scanner: QrScanner | null = null
  private videoElement: HTMLVideoElement | null = null
  private isScanning = false

  constructor() {
    this.init()
  }

  private init() {
    this.render()
    this.setupEventListeners()
  }

  private render() {
    const app = document.querySelector<HTMLDivElement>('#app')!
    app.innerHTML = `
      <div class="min-h-screen bg-gray-100 flex flex-col items-center p-4">
        <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <h1 class="text-2xl font-bold text-gray-800 text-center mb-4">QRコードスキャナー</h1>
          <p class="text-sm text-gray-600 text-center mb-6">カメラでQRコードをかざしてください</p>
          
          <div class="mb-4">
            <video id="qr-video" class="w-full h-64 bg-gray-200 rounded-lg object-cover hidden"></video>
            <div id="camera-placeholder" class="w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-300">
              <div class="text-center">
                <svg class="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p class="mt-2 text-sm text-blue-600 font-medium">カメラを起動</p>
                <p class="text-xs text-gray-500">下のボタンをタップ</p>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button id="start-scan" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md">
              📷 カメラを起動してスキャン
            </button>
            
            <button id="stop-scan" class="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hidden">
              ⏹️ スキャンを停止
            </button>
          </div>

          <div id="result-container" class="mt-6 hidden">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">スキャン結果:</h3>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p id="result-text" class="text-sm text-gray-700 break-all"></p>
              <button id="copy-result" class="mt-2 bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded transition duration-200">
                コピー
              </button>
            </div>
          </div>

          <div id="error-container" class="mt-4 hidden">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <div>
                  <p id="error-text" class="text-sm text-yellow-800"></p>
                  <p class="text-xs text-yellow-600 mt-1">HTTPSでアクセスし、ブラウザでカメラ使用を許可してください</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 max-w-md w-full space-y-4">
          <!-- 免責事項 -->
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <h3 class="text-sm font-semibold text-red-800">免責事項</h3>
                <p class="text-xs text-red-700 mt-1">このアプリは<strong>現状有姿での提供</strong>であり、動作や精度について一切の保証はありません。利用は自己責任でお願いします。</p>
              </div>
            </div>
          </div>

          <!-- プライバシー情報（アコーディオン） -->
          <div class="bg-white rounded-lg shadow">
            <button id="privacy-toggle" class="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                <span class="font-semibold text-gray-800">プライバシーと透明性</span>
              </div>
              <svg id="privacy-arrow" class="w-5 h-5 text-gray-400 transition-transform transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="privacy-content" class="hidden px-4 pb-4">
              <ul class="text-sm text-gray-600 space-y-2 mb-4">
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span>すべての処理はブラウザ内で完結</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span>データの外部送信は一切なし</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span>カメラ映像はローカルでのみ処理</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span>オープンソースで透明性を確保</span>
                </li>
              </ul>
              <a href="https://github.com/f4ah6o/qr-web" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                ソースコードを確認
              </a>
            </div>
          </div>
        </div>
      </div>
    `
  }

  private setupEventListeners() {
    const startButton = document.getElementById('start-scan')!
    const stopButton = document.getElementById('stop-scan')!
    const copyButton = document.getElementById('copy-result')!
    const privacyToggle = document.getElementById('privacy-toggle')!

    startButton.addEventListener('click', () => this.startScanning())
    stopButton.addEventListener('click', () => this.stopScanning())
    copyButton.addEventListener('click', () => this.copyResult())
    privacyToggle.addEventListener('click', () => this.togglePrivacy())
  }

  private togglePrivacy() {
    const content = document.getElementById('privacy-content')!
    const arrow = document.getElementById('privacy-arrow')!
    
    const isHidden = content.classList.contains('hidden')
    
    if (isHidden) {
      content.classList.remove('hidden')
      arrow.classList.add('rotate-180')
    } else {
      content.classList.add('hidden')
      arrow.classList.remove('rotate-180')
    }
  }

  private async startScanning() {
    try {
      this.videoElement = document.getElementById('qr-video') as HTMLVideoElement
      
      this.scanner = new QrScanner(
        this.videoElement,
        (result) => this.onScanSuccess(result.data),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          preferredCamera: 'environment',
          calculateScanRegion: (video) => {
            const smallerDimension = Math.min(video.videoWidth, video.videoHeight)
            const scanRegionSize = Math.round(0.7 * smallerDimension)
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            }
          }
        }
      )

      await this.scanner.start()
      this.isScanning = true
      this.updateUI()
      this.hideError()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Camera not found') || errorMessage.includes('getUserMedia')) {
        this.showError('カメラが見つかりません。デバイスにカメラが接続されているか確認してください。')
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        this.showError('カメラの使用が許可されていません。ブラウザの設定でカメラアクセスを許可してください。')
      } else {
        this.showError('カメラの起動に失敗しました。ページを再読み込みして再度お試しください。')
      }
      console.error('スキャン開始エラー:', error)
    }
  }

  private stopScanning() {
    if (this.scanner) {
      this.scanner.stop()
      this.scanner.destroy()
      this.scanner = null
    }
    this.isScanning = false
    this.updateUI()
  }

  private onScanSuccess(result: string) {
    document.getElementById('result-text')!.textContent = result
    document.getElementById('result-container')!.classList.remove('hidden')
    this.hideError()
  }

  private async copyResult() {
    const resultText = document.getElementById('result-text')!.textContent
    if (resultText) {
      try {
        await navigator.clipboard.writeText(resultText)
        const button = document.getElementById('copy-result')!
        const originalText = button.textContent
        button.textContent = 'コピー完了!'
        setTimeout(() => {
          button.textContent = originalText
        }, 2000)
      } catch (error) {
        console.error('コピーエラー:', error)
      }
    }
  }

  private updateUI() {
    const startButton = document.getElementById('start-scan')!
    const stopButton = document.getElementById('stop-scan')!
    const videoElement = document.getElementById('qr-video')!
    const placeholder = document.getElementById('camera-placeholder')!

    if (this.isScanning) {
      startButton.classList.add('hidden')
      stopButton.classList.remove('hidden')
      videoElement.classList.remove('hidden')
      placeholder.classList.add('hidden')
    } else {
      startButton.classList.remove('hidden')
      stopButton.classList.add('hidden')
      videoElement.classList.add('hidden')
      placeholder.classList.remove('hidden')
    }
  }

  private showError(message: string) {
    document.getElementById('error-text')!.textContent = message
    document.getElementById('error-container')!.classList.remove('hidden')
  }

  private hideError() {
    document.getElementById('error-container')!.classList.add('hidden')
  }
}

new QRScannerApp()
