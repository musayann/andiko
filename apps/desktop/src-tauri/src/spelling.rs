//! Spell-checking for the editor (see packages/editor/src/workspace/spelling.ts).

#[cfg(target_os = "macos")]
use objc2::runtime::AnyObject;
#[cfg(target_os = "macos")]
use objc2_app_kit::NSSpellChecker;
#[cfg(target_os = "macos")]
use objc2_foundation::{ns_string, NSDictionary, NSNumber, NSRange, NSString, NSTextCheckingType, NSUserDefaults};

/// WebKit only underlines misspelled words when `WebContinuousSpellCheckingEnabled` is on, which
/// Safari sets for itself but other apps don't. The automatic corrections and substitutions stay off,
/// as they'd change Markdown (smart quotes, dashes) behind the writer's back.
///
/// These are registered defaults: choices made in the Spelling and Substitutions menus are saved
/// over them. WebKit reads them once, so this runs before the webview is created. A global
/// `NSAllowContinuousSpellChecking = NO` (which Grammarly sets) still turns the underlines off.
#[cfg(target_os = "macos")]
pub fn register_defaults() {
    let on = NSNumber::numberWithBool(true);
    let off = NSNumber::numberWithBool(false);
    let (on, off): (&AnyObject, &AnyObject) = (&on, &off);
    let defaults = NSDictionary::<NSString, AnyObject>::from_slices(
        &[
            ns_string!("WebContinuousSpellCheckingEnabled"),
            ns_string!("WebAutomaticSpellingCorrectionEnabled"),
            ns_string!("WebAutomaticTextReplacementEnabled"),
            ns_string!("WebAutomaticQuoteSubstitutionEnabled"),
            ns_string!("WebAutomaticDashSubstitutionEnabled"),
        ],
        &[on, off, off, off, off],
    );
    // SAFETY: the keys are strings and the values are numbers, as user defaults expect
    unsafe { NSUserDefaults::standardUserDefaults().registerDefaults(&defaults) };
}

#[cfg(not(target_os = "macos"))]
pub fn register_defaults() {}

/// The words in `paragraphs` that the system spell checker finds misspelled. WebKit underlines with
/// the same checker, one paragraph (an editor line) at a time: the language is guessed from the
/// surrounding words, so a word alone can pass where it's flagged in a sentence.
/// Not `async`, so it runs on the main thread like the rest of AppKit.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn misspelled_words(paragraphs: Vec<String>) -> Vec<String> {
    let checker = NSSpellChecker::sharedSpellChecker();
    let mut words = Vec::new();
    for paragraph in paragraphs {
        let text = NSString::from_str(&paragraph);
        // SAFETY: no options, and no word count to write to
        let results = unsafe {
            checker.checkString_range_types_options_inSpellDocumentWithTag_orthography_wordCount(
                &text,
                NSRange::new(0, text.length()),
                NSTextCheckingType::Spelling.0,
                None,
                0,
                None,
                std::ptr::null_mut(),
            )
        };
        words.extend(results.iter().map(|result| text.substringWithRange(result.range()).to_string()));
    }
    words
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn misspelled_words(_paragraphs: Vec<String>) -> Vec<String> {
    Vec::new()
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn finds_misspelled_words() {
        let paragraphs = ["I saw teh dog, didn't I?", "We recieve the parcel."].map(String::from).to_vec();
        assert_eq!(misspelled_words(paragraphs), ["teh", "recieve"]);
    }

    #[test]
    fn passes_correct_text() {
        assert!(misspelled_words(vec!["The quick brown fox.".into(), String::new()]).is_empty());
    }
}
