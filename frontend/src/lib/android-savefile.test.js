// "Save to device" is a native dialog on both phones: Android's create-document picker and
// iOS's Files picker. The WebView never gets a storage permission, and the file the page wrote
// into its cache is copied only to the place the person chose.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const androidPath = new URL('../../android/app/src/main/java/ch/duartesantos/opengym/', import.meta.url)
const iosPath = new URL('../../ios/App/App/', import.meta.url)
const java = readFileSync(new URL('SaveFilePlugin.java', androidPath), 'utf8')
const activity = readFileSync(new URL('MainActivity.java', androidPath), 'utf8')
const swift = readFileSync(new URL('SaveFilePlugin.swift', iosPath), 'utf8')
const mainVc = readFileSync(new URL('MainViewController.swift', iosPath), 'utf8')
const project = readFileSync(new URL('../App.xcodeproj/project.pbxproj', iosPath), 'utf8')
const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8')

describe('Android SaveFilePlugin', () => {
  it('asks the system for the destination and copies the cache file there', () => {
    expect(java).toContain('Intent.ACTION_CREATE_DOCUMENT')
    expect(java).toContain('Intent.EXTRA_TITLE')
    expect(java).toContain('CATEGORY_OPENABLE')
    expect(java).toContain('application/octet-stream')
    expect(java).toContain('openOutputStream(target, "wt")')
    expect(java).toContain('ret.put("saved", true)')
    expect(activity).toContain('registerPlugin(SaveFilePlugin.class)')
  })

  it('needs no storage permission: the document picker grants exactly the chosen file', () => {
    expect(manifest).not.toContain('WRITE_EXTERNAL_STORAGE')
    expect(manifest).not.toContain('MANAGE_EXTERNAL_STORAGE')
  })
})

describe('iOS SaveFilePlugin', () => {
  it('uses the Files picker as a copy and answers saved or cancelled', () => {
    expect(swift).toContain('UIDocumentPickerViewController(forExporting: [url], asCopy: true)')
    expect(swift).toContain('UIDocumentPickerDelegate')
    expect(swift).toContain('didPickDocumentsAt')
    expect(swift).toContain('documentPickerWasCancelled')
    expect(swift).toContain('pending?.resolve(["saved": true])')
    expect(swift).toContain('pending?.resolve(["cancelled": true])')
    expect(mainVc).toContain('registerPluginInstance(SaveFilePlugin())')
    expect(project).toContain('SaveFilePlugin.swift in Sources')
  })
})
