import './style.css'
import QrScanner from 'qr-scanner'

interface ScanHistoryItem {
  id: string
  data: string
  timestamp: number
  type: string
}

class QRScannerApp {
  private scanner: QrScanner | null = null
  private videoElement: HTMLVideoElement | null = null
  private isScanning = false
  private scanHistory: ScanHistoryItem[] = []
  private opfsRoot: FileSystemDirectoryHandle | null = null
  private deferredPrompt: any = null
  private currentZoom = 1
  private mediaStream: MediaStream | null = null
  private visualZoom = 1

  constructor() {
    this.init()
    this.setupPWA()
  }

  private init() {
    this.render()
    this.setupEventListeners()
    // 非同期処理は別途実行
    this.initializeAsync()
  }

  private async initializeAsync() {
    await this.initOPFS()
    await this.loadHistory()
  }

  private render() {
    const app = document.querySelector<HTMLDivElement>('#app')!
    app.innerHTML = `
      <div class="h-screen bg-gray-100 flex flex-col lg:flex-row items-center lg:items-start lg:justify-center p-2 sm:p-4 overflow-y-auto">
        <div class="max-w-md lg:max-w-6xl w-full lg:flex lg:gap-6">
          <!-- 左カラム: スキャン機能 -->
          <div class="lg:w-1/2 bg-white rounded-lg shadow-lg p-6">
          <h1 class="text-2xl font-bold text-gray-800 text-center mb-4">QRコードスキャナー</h1>
          <p class="text-sm text-gray-600 text-center mb-6">カメラでQRコードをかざしてください</p>
          
          <div class="mb-4">
            <!-- ビデオコンテナ（クロップ用） -->
            <div id="video-container" class="w-full h-64 landscape:h-40 bg-gray-200 rounded-lg overflow-hidden relative hidden">
              <video id="qr-video" class="w-full h-full object-cover transform-gpu transition-transform duration-200"></video>
            </div>
            <!-- ズームコントロール -->
            <div id="zoom-controls" class="mt-2 hidden">
              <div class="flex items-center justify-center space-x-4">
                <button id="zoom-out" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">
                  🔍➖
                </button>
                <span id="zoom-level" class="text-sm text-gray-600 min-w-[60px] text-center">1.0x</span>
                <button id="zoom-in" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">
                  🔍➕
                </button>
              </div>
              <div class="text-center mt-1">
                <span class="text-xs text-gray-500">画面拡大（ピンチで調整可能）</span>
              </div>
            </div>
            <div id="camera-placeholder" class="w-full h-64 landscape:h-40 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-300">
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
            <div class="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <div class="flex-1">
                  <p id="result-text" class="text-sm text-gray-700 break-all font-mono bg-white p-2 rounded border"></p>
                  <div class="mt-2">
                    <button id="copy-result" class="bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded transition duration-200">
                      📋 コピー
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- モバイル・タブレット縦用の履歴 (lg以上では非表示) -->
          <div id="history-container" class="mt-6 lg:hidden">
            <div class="bg-white rounded-lg shadow">
              <button id="history-toggle-mobile" class="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="font-semibold text-gray-800">スキャン履歴</span>
                  <span id="history-count-mobile" class="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">0</span>
                </div>
                <svg id="history-arrow-mobile" class="w-5 h-5 text-gray-400 transition-transform transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div id="history-content-mobile" class="hidden">
                <div class="px-4 pb-4">
                  <div id="history-list-mobile" class="space-y-2 max-h-80 overflow-y-auto">
                    <!-- 履歴アイテムがここに表示される -->
                  </div>
                  <div class="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                    <button id="clear-history-mobile" class="text-sm text-red-600 hover:text-red-800 font-medium">
                      🗑️ 履歴をクリア
                    </button>
                    <button id="export-history-mobile" class="text-sm text-blue-600 hover:text-blue-800 font-medium ml-auto">
                      📤 エクスポート
                    </button>
                  </div>
                </div>
              </div>
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
          
          <!-- 右カラム: 履歴と情報 -->
          <div class="lg:w-1/2 mt-6 lg:mt-0 space-y-4">
            <!-- スキャン履歴 (デスクトップでは右カラムに移動) -->
            <div class="bg-white rounded-lg shadow-lg">
              <button id="history-toggle" class="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="font-semibold text-gray-800">スキャン履歴</span>
                  <span id="history-count" class="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">0</span>
                </div>
                <svg id="history-arrow" class="w-5 h-5 text-gray-400 transition-transform transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div id="history-content" class="lg:block">
                <div class="px-4 pb-4">
                  <div id="history-list" class="space-y-2 max-h-80 lg:max-h-64 overflow-y-auto">
                    <!-- 履歴アイテムがここに表示される -->
                  </div>
                  <div class="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                    <button id="clear-history" class="text-sm text-red-600 hover:text-red-800 font-medium">
                      🗑️ 履歴をクリア
                    </button>
                    <button id="export-history" class="text-sm text-blue-600 hover:text-blue-800 font-medium ml-auto">
                      📤 エクスポート
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- PWAインストール -->
            <div id="pwa-install" class="bg-blue-50 border border-blue-200 rounded-lg p-4 hidden">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-blue-800 mb-2">アプリをインストール</h3>
                  <p class="text-xs text-blue-700 mb-3">ホーム画面に追加してネイティブアプリのように使用できます</p>
                  <button id="install-button" class="bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded transition duration-200">
                    📱 インストール
                  </button>
                </div>
              </div>
            </div>

            <!-- 免責事項・プライバシー情報 -->
            <div class="space-y-4">
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
      </div>
    `
  }

  private setupEventListeners() {
    const startButton = document.getElementById('start-scan')!
    const stopButton = document.getElementById('stop-scan')!
    const copyButton = document.getElementById('copy-result')!
    const privacyToggle = document.getElementById('privacy-toggle')!
    
    // デスクトップ用履歴ボタン
    const historyToggle = document.getElementById('history-toggle')!
    const clearHistory = document.getElementById('clear-history')!
    const exportHistory = document.getElementById('export-history')!
    
    // モバイル用履歴ボタン
    const historyToggleMobile = document.getElementById('history-toggle-mobile')!
    const clearHistoryMobile = document.getElementById('clear-history-mobile')!
    const exportHistoryMobile = document.getElementById('export-history-mobile')!

    startButton.addEventListener('click', () => this.startScanning())
    stopButton.addEventListener('click', () => this.stopScanning())
    copyButton.addEventListener('click', () => this.copyResult())
    privacyToggle.addEventListener('click', () => this.togglePrivacy())
    
    // デスクトップ用履歴イベント
    historyToggle.addEventListener('click', () => this.toggleHistory())
    clearHistory.addEventListener('click', () => this.clearHistory())
    exportHistory.addEventListener('click', () => this.exportHistory())
    
    // モバイル用履歴イベント
    historyToggleMobile.addEventListener('click', () => this.toggleHistoryMobile())
    clearHistoryMobile.addEventListener('click', () => this.clearHistory())
    exportHistoryMobile.addEventListener('click', () => this.exportHistory())
    
    // PWAインストールボタン
    const installButton = document.getElementById('install-button')
    if (installButton) {
      installButton.addEventListener('click', () => this.installPWA())
    }
    
    // ズームコントロール
    const zoomInButton = document.getElementById('zoom-in')
    const zoomOutButton = document.getElementById('zoom-out')
    if (zoomInButton && zoomOutButton) {
      zoomInButton.addEventListener('click', () => this.zoomIn())
      zoomOutButton.addEventListener('click', () => this.zoomOut())
    }
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
      // 前回の結果をクリア
      this.clearCurrentResult()
      
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
            const scanRegionSize = Math.round(0.9 * smallerDimension)
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            }
          }
        }
      )

      // UIを先に更新してビデオ要素を表示
      this.isScanning = true
      this.updateUI()
      
      await this.scanner.start()
      
      // MediaStreamを取得してズーム機能を有効化
      this.mediaStream = this.videoElement.srcObject as MediaStream
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
    this.mediaStream = null
    this.currentZoom = 1
    this.visualZoom = 1
    this.isScanning = false
    this.updateUI()
  }

  private async onScanSuccess(result: string) {
    const resultElement = document.getElementById('result-text')!
    const qrType = this.detectQRType(result)
    
    // URLの場合はリンク化、それ以外はテキスト表示
    if (qrType === 'URL') {
      resultElement.innerHTML = `<a href="${result}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${result}</a>`
    } else {
      resultElement.textContent = result
    }
    
    document.getElementById('result-container')!.classList.remove('hidden')
    this.hideError()
    
    // 自動で履歴に保存（重複チェック付き）
    await this.autoSaveToHistory(result)
  }

  private async copyResult() {
    const resultElement = document.getElementById('result-text')!
    // リンクの場合はtextContentで、テキストの場合もtextContentを使用
    const resultText = resultElement.textContent || resultElement.innerText
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
    const videoContainer = document.getElementById('video-container')!
    const placeholder = document.getElementById('camera-placeholder')!
    const zoomControls = document.getElementById('zoom-controls')!

    if (this.isScanning) {
      startButton.classList.add('hidden')
      stopButton.classList.remove('hidden')
      videoContainer.classList.remove('hidden')
      placeholder.classList.add('hidden')
      zoomControls.classList.remove('hidden')
      this.updateZoomLevel()
      this.setupTouchEvents()
    } else {
      startButton.classList.remove('hidden')
      stopButton.classList.add('hidden')
      videoContainer.classList.add('hidden')
      placeholder.classList.remove('hidden')
      zoomControls.classList.add('hidden')
    }
  }

  private showError(message: string) {
    document.getElementById('error-text')!.textContent = message
    document.getElementById('error-container')!.classList.remove('hidden')
  }

  private hideError() {
    document.getElementById('error-container')!.classList.add('hidden')
  }

  // OPFS関連メソッド
  private async initOPFS() {
    try {
      if ('navigator' in globalThis && 'storage' in navigator && 'getDirectory' in navigator.storage) {
        this.opfsRoot = await navigator.storage.getDirectory()
      }
    } catch (error) {
      console.warn('OPFS not supported:', error)
    }
  }

  private async loadHistory() {
    if (!this.opfsRoot) return

    try {
      const fileHandle = await this.opfsRoot.getFileHandle('qr-history.json', { create: true })
      const file = await fileHandle.getFile()
      
      if (file.size > 0) {
        const text = await file.text()
        this.scanHistory = JSON.parse(text)
      }
    } catch (error) {
      console.warn('Failed to load history:', error)
      this.scanHistory = []
    }
    
    this.updateHistoryUI()
  }

  private async saveHistory() {
    if (!this.opfsRoot) return

    try {
      const fileHandle = await this.opfsRoot.getFileHandle('qr-history.json', { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(this.scanHistory, null, 2))
      await writable.close()
    } catch (error) {
      console.warn('Failed to save history:', error)
    }
  }

  // 結果クリア機能
  private clearCurrentResult() {
    const resultContainer = document.getElementById('result-container')
    const resultText = document.getElementById('result-text')
    
    if (resultContainer) resultContainer.classList.add('hidden')
    if (resultText) resultText.textContent = ''
  }

  // 自動履歴保存機能（重複チェック付き）
  private async autoSaveToHistory(result: string) {
    if (!result) return

    // 最新の履歴と同一かチェック
    if (this.scanHistory.length > 0 && this.scanHistory[0].data === result) {
      console.log('重複するデータのため保存をスキップ')
      return
    }

    const historyItem: ScanHistoryItem = {
      id: Date.now().toString(),
      data: result,
      timestamp: Date.now(),
      type: this.detectQRType(result)
    }

    this.scanHistory.unshift(historyItem)
    
    // 最大100件まで
    if (this.scanHistory.length > 100) {
      this.scanHistory = this.scanHistory.slice(0, 100)
    }

    await this.saveHistory()
    this.updateHistoryUI()

    // 自動保存完了の視覚的フィードバック
    this.showAutoSaveNotification()
  }


  // 自動保存通知の表示
  private showAutoSaveNotification() {
    const resultContainer = document.getElementById('result-container')
    if (!resultContainer) return

    // 既存の通知があれば削除
    const existingNotification = resultContainer.querySelector('.auto-save-notification')
    if (existingNotification) {
      existingNotification.remove()
    }

    // 通知要素を作成
    const notification = document.createElement('div')
    notification.className = 'auto-save-notification mt-2 text-sm text-green-600 flex items-center'
    notification.innerHTML = `
      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
      </svg>
      履歴に自動保存されました
    `

    resultContainer.appendChild(notification)

    // 3秒後に非表示
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  private detectQRType(data: string): string {
    if (data.startsWith('http://') || data.startsWith('https://')) return 'URL'
    if (data.startsWith('mailto:')) return 'Email'
    if (data.startsWith('tel:')) return 'Phone'
    if (data.startsWith('wifi:')) return 'WiFi'
    if (data.includes('@') && data.includes('.')) return 'Email'
    return 'Text'
  }

  // 履歴UI操作（デスクトップ用）
  private toggleHistory() {
    const content = document.getElementById('history-content')!
    const arrow = document.getElementById('history-arrow')!
    
    const isHidden = content.classList.contains('hidden')
    
    if (isHidden) {
      content.classList.remove('hidden')
      arrow.classList.add('rotate-180')
    } else {
      content.classList.add('hidden')
      arrow.classList.remove('rotate-180')
    }
  }

  // 履歴UI操作（モバイル用）
  private toggleHistoryMobile() {
    const content = document.getElementById('history-content-mobile')!
    const arrow = document.getElementById('history-arrow-mobile')!
    
    const isHidden = content.classList.contains('hidden')
    
    if (isHidden) {
      content.classList.remove('hidden')
      arrow.classList.add('rotate-180')
    } else {
      content.classList.add('hidden')
      arrow.classList.remove('rotate-180')
    }
  }

  private updateHistoryUI() {
    // デスクトップ用履歴
    const historyList = document.getElementById('history-list')
    const historyCount = document.getElementById('history-count')
    
    // モバイル用履歴
    const historyListMobile = document.getElementById('history-list-mobile')
    const historyCountMobile = document.getElementById('history-count-mobile')
    
    // 履歴コンテンツを生成する共通関数
    const generateHistoryHTML = () => {
      if (this.scanHistory.length === 0) {
        return '<p class="text-sm text-gray-500 text-center py-4">履歴はありません</p>'
      }

      return this.scanHistory.map(item => {
        const date = new Date(item.timestamp).toLocaleDateString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        const typeIcon = this.getTypeIcon(item.type)
        const preview = item.data.length > 50 ? item.data.substring(0, 50) + '...' : item.data
        const isUrl = item.type === 'URL'
        
        return `
          <div class="flex items-start p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors cursor-pointer" onclick="window.qrApp.copyHistoryItem('${item.id}')">
            <span class="text-lg mr-3 flex-shrink-0">${typeIcon}</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 mb-1">${date} • ${item.type}</p>
              ${isUrl ? 
                `<a href="${item.data}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:text-blue-800 underline break-all font-mono" onclick="event.stopPropagation()">${preview}</a>` :
                `<p class="text-sm text-gray-700 break-all font-mono">${preview}</p>`
              }
            </div>
            <button class="ml-3 text-gray-400 hover:text-red-600 flex-shrink-0" onclick="event.stopPropagation(); window.qrApp.deleteHistoryItem('${item.id}')">
              🗑️
            </button>
          </div>
        `
      }).join('')
    }
    
    const countText = this.scanHistory.length.toString()
    const historyHTML = generateHistoryHTML()
    
    // デスクトップ用履歴を更新
    if (historyList && historyCount) {
      historyCount.textContent = countText
      historyList.innerHTML = historyHTML
    }
    
    // モバイル用履歴を更新
    if (historyListMobile && historyCountMobile) {
      historyCountMobile.textContent = countText
      historyListMobile.innerHTML = historyHTML
    }
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'URL': return '🔗'
      case 'Email': return '📧'
      case 'Phone': return '📞'
      case 'WiFi': return '📶'
      default: return '📄'
    }
  }

  public async copyHistoryItem(id: string) {
    const item = this.scanHistory.find(h => h.id === id)
    if (!item) return

    try {
      await navigator.clipboard.writeText(item.data)
      // 一時的にフィードバック表示
      const element = document.querySelector(`[onclick*="${id}"]`) as HTMLElement
      if (element) {
        const original = element.style.backgroundColor
        element.style.backgroundColor = '#dcfce7'
        setTimeout(() => {
          element.style.backgroundColor = original
        }, 1000)
      }
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  public async deleteHistoryItem(id: string) {
    this.scanHistory = this.scanHistory.filter(h => h.id !== id)
    await this.saveHistory()
    this.updateHistoryUI()
  }

  private async clearHistory() {
    if (confirm('すべての履歴を削除しますか？この操作は取り消せません。')) {
      this.scanHistory = []
      await this.saveHistory()
      this.updateHistoryUI()
    }
  }

  private exportHistory() {
    if (this.scanHistory.length === 0) {
      alert('履歴がありません')
      return
    }

    const csvContent = [
      'Timestamp,Type,Data',
      ...this.scanHistory.map(item => {
        const date = new Date(item.timestamp).toISOString()
        const escapedData = `"${item.data.replace(/"/g, '""')}"`
        return `${date},${item.type},${escapedData}`
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `qr-scan-history-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // PWA関連メソッド
  private setupPWA() {
    // beforeinstallpromptイベントをキャッチ
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.showInstallPrompt()
    })

    // アプリがインストールされた時
    window.addEventListener('appinstalled', () => {
      this.hideInstallPrompt()
      console.log('PWA was installed')
    })

    // 既にインストール済みかチェック
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.hideInstallPrompt()
    }
  }

  private showInstallPrompt() {
    const installPrompt = document.getElementById('pwa-install')
    if (installPrompt) {
      installPrompt.classList.remove('hidden')
    }
  }

  private hideInstallPrompt() {
    const installPrompt = document.getElementById('pwa-install')
    if (installPrompt) {
      installPrompt.classList.add('hidden')
    }
  }

  private async installPWA() {
    if (!this.deferredPrompt) return

    this.deferredPrompt.prompt()
    const choiceResult = await this.deferredPrompt.userChoice
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }
    
    this.deferredPrompt = null
    this.hideInstallPrompt()
  }

  // ズーム機能（視覚的ズーム）
  private zoomIn() {
    if (this.visualZoom < 3) {
      this.visualZoom += 0.5
      this.applyVisualZoom()
    }
  }

  private zoomOut() {
    if (this.visualZoom > 1) {
      this.visualZoom -= 0.5
      this.applyVisualZoom()
    }
  }

  private applyVisualZoom() {
    const videoElement = document.getElementById('qr-video') as HTMLVideoElement
    if (videoElement) {
      videoElement.style.transform = `scale(${this.visualZoom})`
    }
    this.updateZoomLevel()
  }

  private updateZoomLevel() {
    const zoomLevelElement = document.getElementById('zoom-level')
    if (zoomLevelElement) {
      zoomLevelElement.textContent = `${this.visualZoom.toFixed(1)}x`
    }
  }

  // タッチイベント（ピンチズーム）
  private setupTouchEvents() {
    const videoContainer = document.getElementById('video-container')
    if (!videoContainer) return

    let initialDistance = 0
    let initialZoom = this.visualZoom

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0
      const touch1 = touches[0]
      const touch2 = touches[1]
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
    }

    videoContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        initialDistance = getTouchDistance(e.touches)
        initialZoom = this.visualZoom
      }
    })

    videoContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const currentDistance = getTouchDistance(e.touches)
        if (initialDistance > 0) {
          const scale = currentDistance / initialDistance
          let newZoom = initialZoom * scale
          
          // ズーム範囲を制限
          newZoom = Math.max(1, Math.min(3, newZoom))
          
          this.visualZoom = Math.round(newZoom * 2) / 2 // 0.5刻みに丸める
          this.applyVisualZoom()
        }
      }
    })

    videoContainer.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialDistance = 0
      }
    })
  }
}

// グローバルアクセス用
declare global {
  interface Window {
    qrApp: QRScannerApp
  }
}

const app = new QRScannerApp()
window.qrApp = app
