import Foundation
import Capacitor
import UIKit

/**
 * "Save to device" for an export: iOS's Files picker, so the person chooses the folder and the
 * name (On My iPhone, iCloud Drive, a third-party file provider). The page writes the file into
 * the app cache first and passes its file URL; the picker takes that file as a copy.
 *
 *   const SaveFile = registerPlugin('SaveFile')
 *   await SaveFile.save({ path: 'file:///…/Caches/opengym-backup.json',
 *                         filename: 'opengym-backup.json',
 *                         mime: 'application/json' })   // { saved: true } / { cancelled: true }
 */
@objc(SaveFilePlugin)
public class SaveFilePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "SaveFilePlugin"
    public let jsName = "SaveFile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
    ]

    private var pending: CAPPluginCall?

    @objc func save(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let url = URL(string: path), url.isFileURL else {
            call.reject("path must be a file URL")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard self.pending == nil else {
                call.reject("another save is already open")
                return
            }
            guard let presenter = self.bridge?.viewController else {
                call.reject("the app window is not ready")
                return
            }
            self.pending = call
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        pending?.resolve(["saved": true])
        pending = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pending?.resolve(["cancelled": true])
        pending = nil
    }
}
