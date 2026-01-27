"""
Sequence Analyzer for Quran Recitation Tracking
Detects skips, jumps, and page mismatches in recitation flow
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import logging


@dataclass
class SequenceError:
    """Represents a sequence error detected during recitation"""
    error_type: str  # "skip_aya", "page_mismatch", "backwards_anomaly"
    severity: str  # "warning", "error"
    message: str
    details: Dict[str, Any]


class SequenceAnalyzer:
    """Analyzes recitation sequence to detect skips and mismatches"""
    
    def __init__(
        self,
        skip_min_words: int = 12,
        skip_min_ayas: int = 1,
        backwards_tolerance: int = 3,
        low_confidence_threshold: float = 0.3,
        min_segment_score: float = 0.4
    ):
        """
        Initialize sequence analyzer with configurable thresholds
        
        Args:
            skip_min_words: Minimum words gap to consider as skip (default 12)
            skip_min_ayas: Minimum complete ayas to consider as skip (default 1)
            backwards_tolerance: Allow going back this many words (default 3)
            low_confidence_threshold: Below this confidence, consider mismatch (default 0.3)
            min_segment_score: Minimum segment score for valid alignment (default 0.4)
        """
        self.skip_min_words = skip_min_words
        self.skip_min_ayas = skip_min_ayas
        self.backwards_tolerance = backwards_tolerance
        self.low_confidence_threshold = low_confidence_threshold
        self.min_segment_score = min_segment_score
        
        logging.info(f"SequenceAnalyzer initialized with thresholds: "
                    f"skip_min_words={skip_min_words}, skip_min_ayas={skip_min_ayas}")
    
    def analyze(
        self,
        prev_pos: int,
        alignment_result,
        all_words: List,
        current_page: int,
        consecutive_low_confidence: int = 0
    ) -> Optional[SequenceError]:
        """
        Analyze alignment result for sequence errors
        
        Args:
            prev_pos: Previous global word position before this chunk
            alignment_result: AlignmentResult from QuranAlignmentEngine
            all_words: List of all WordEntry objects from alignment engine
            current_page: Current page number
            consecutive_low_confidence: Number of consecutive low confidence chunks
        
        Returns:
            SequenceError if detected, None otherwise
        """
        
        # Extract correct matches from alignment result
        correct_matches = [
            m for m in alignment_result.matches
            if m.alignment_type == "match" and m.is_correct and m.quran_word
        ]
        
        if not correct_matches:
            # No correct matches - check if this is persistent page mismatch
            if (consecutive_low_confidence >= 3 and 
                alignment_result.confidence < self.low_confidence_threshold and
                alignment_result.segment_score < self.min_segment_score):
                
                return SequenceError(
                    error_type="page_mismatch",
                    severity="error",
                    message="التلاوة الحالية لا تطابق آيات هذه الصفحة. تأكد أنك تقرأ من نفس الموضع.",
                    details={
                        "page": current_page,
                        "confidence": alignment_result.confidence,
                        "segment_score": alignment_result.segment_score,
                        "consecutive_low_confidence": consecutive_low_confidence
                    }
                )
            return None
        
        # Get min and max global indices from correct matches
        global_indices = [m.quran_word.global_index for m in correct_matches]
        min_idx_chunk = min(global_indices)
        max_idx_chunk = max(global_indices)
        
        # Check for forward skip (jumping ahead)
        gap = min_idx_chunk - prev_pos
        
        if gap >= self.skip_min_words:
            # Potential skip detected - verify it's significant
            skipped_info = self._analyze_skipped_region(
                prev_pos, min_idx_chunk, all_words, current_page
            )
            
            if skipped_info and skipped_info['num_ayas'] >= self.skip_min_ayas:
                # Significant skip confirmed
                return SequenceError(
                    error_type="skip_aya",
                    severity="warning",
                    message=f"تم تخطي الآيات من {skipped_info['from_aya_no']} إلى {skipped_info['to_aya_no']}. "
                           f"يرجى إعادة التلاوة من الموضع الصحيح.",
                    details={
                        "page": current_page,
                        "from_aya_no": skipped_info['from_aya_no'],
                        "to_aya_no": skipped_info['to_aya_no'],
                        "skipped_aya_ids": skipped_info['skipped_aya_ids'],
                        "num_words_skipped": gap,
                        "num_ayas_skipped": skipped_info['num_ayas'],
                        "confidence": alignment_result.confidence,
                        "segment_score": alignment_result.segment_score
                    }
                )
        
        # Check for backwards anomaly (going back significantly)
        if max_idx_chunk < prev_pos - self.backwards_tolerance:
            backwards_distance = prev_pos - max_idx_chunk
            
            return SequenceError(
                error_type="backwards_anomaly",
                severity="warning",
                message=f"تم الرجوع للخلف بمقدار {backwards_distance} كلمة. قد يكون هناك خلط في التلاوة.",
                details={
                    "page": current_page,
                    "prev_pos": prev_pos,
                    "current_pos": max_idx_chunk,
                    "backwards_distance": backwards_distance,
                    "confidence": alignment_result.confidence
                }
            )
        
        # No sequence error detected
        return None
    
    def _analyze_skipped_region(
        self,
        start_pos: int,
        end_pos: int,
        all_words: List,
        current_page: int
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze the region between start_pos and end_pos to identify skipped ayas
        
        Args:
            start_pos: Starting global word position (exclusive)
            end_pos: Ending global word position (exclusive)
            all_words: List of all WordEntry objects
            current_page: Current page number
        
        Returns:
            Dictionary with skipped aya information, or None if invalid
        """
        if start_pos >= end_pos or start_pos < 0 or end_pos > len(all_words):
            return None
        
        # Get words in the skipped region
        skipped_words = all_words[start_pos + 1:end_pos]
        
        if not skipped_words:
            return None
        
        # Collect unique aya_ids and aya_nos
        aya_ids = set()
        aya_nos = set()
        
        for word in skipped_words:
            aya_ids.add(word.aya_id)
            aya_nos.add(word.aya)
        
        if not aya_ids:
            return None
        
        # Sort aya numbers to get range
        sorted_aya_nos = sorted(aya_nos)
        
        return {
            "skipped_aya_ids": list(aya_ids),
            "from_aya_no": sorted_aya_nos[0],
            "to_aya_no": sorted_aya_nos[-1],
            "num_ayas": len(aya_ids),
            "num_words": len(skipped_words)
        }
    
    def should_alert(
        self,
        error: Optional[SequenceError],
        min_confidence_for_alert: float = 0.5
    ) -> bool:
        """
        Determine if an error should trigger an alert to the user
        
        Args:
            error: SequenceError object or None
            min_confidence_for_alert: Minimum confidence to trust the detection
        
        Returns:
            True if should alert user, False otherwise
        """
        if not error:
            return False
        
        # Always alert on page mismatch (high confidence in detection)
        if error.error_type == "page_mismatch":
            return True
        
        # For skip_aya, check if confidence is high enough
        if error.error_type == "skip_aya":
            confidence = error.details.get("confidence", 0.0)
            segment_score = error.details.get("segment_score", 0.0)
            
            # Alert if both confidence and segment score are reasonable
            return (confidence >= min_confidence_for_alert or 
                   segment_score >= self.min_segment_score + 0.1)
        
        # For backwards anomaly, be more cautious
        if error.error_type == "backwards_anomaly":
            confidence = error.details.get("confidence", 0.0)
            backwards_distance = error.details.get("backwards_distance", 0)
            
            # Only alert if going back significantly AND confidence is decent
            return backwards_distance >= 10 and confidence >= 0.4
        
        return False

