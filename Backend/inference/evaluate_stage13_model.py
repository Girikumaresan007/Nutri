#!/usr/bin/env python3
"""
Stage 13: Model Evaluation & Out-of-Distribution Handling Audit
Evaluates DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3 on genuine manifest dataset.
"""

import os
import sys
import json
import time
import math
import tracemalloc
from collections import defaultdict
from PIL import Image

import torch
import torch.nn.functional as F
from transformers import AutoImageProcessor, AutoModelForImageClassification

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

MODEL_NAME = os.getenv("HF_MODEL_NAME", "DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3")
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "dataset_manifest.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "stage13_model_evaluation_results.json")

def calculate_entropy(probabilities):
    entropy = 0.0
    for p in probabilities:
        if p > 1e-12:
            entropy -= p * math.log(p)
    return round(entropy, 4)

def run_evaluation():
    print("=" * 80)
    print("STAGE 13: HONEST REAL-WORLD MODEL EVALUATION & OOD AUDIT")
    print(f"Model ID: {MODEL_NAME}")
    print(f"Python:   {sys.version}")
    print("=" * 80)

    # 1. Measure cold start model loading
    tracemalloc.start()
    t0_load = time.perf_counter()
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME, local_files_only=True)
    model = AutoModelForImageClassification.from_pretrained(MODEL_NAME, local_files_only=True)
    model.eval()
    model_load_time_sec = round(time.perf_counter() - t0_load, 3)
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    print(f"\n[Model Startup] Cold Load Time: {model_load_time_sec}s | Peak Alloc Memory: {peak_mem / (1024*1024):.2f} MB")
    id2label = model.config.id2label
    num_classes = len(id2label)
    print(f"[Model Architecture] ViT Backbone: {model.config.model_type} | Output Heads: {num_classes} classes")

    # Load dataset manifest
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"\n[Dataset Manifest] Loaded {len(manifest)} verified real images across splits.")

    records = []
    latencies = []
    
    # 2. Iterate through manifest images
    for entry in manifest:
        img_rel = entry["filePath"]
        img_full = os.path.join(os.path.dirname(__file__), img_rel)
        if not os.path.exists(img_full):
            print(f"  ✗ WARNING: File missing: {img_full}")
            continue

        raw_img = Image.open(img_full).convert("RGB")
        inputs = processor(images=raw_img, return_tensors="pt")

        t0_inf = time.perf_counter()
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probs = F.softmax(logits, dim=-1)[0].tolist()
        latency_ms = (time.perf_counter() - t0_inf) * 1000.0
        latencies.append(latency_ms)

        # Sort predictions
        ranked = sorted(
            [{"label": id2label[i], "score": float(probs[i])} for i in range(num_classes)],
            key=lambda x: x["score"],
            reverse=True
        )

        top1 = ranked[0]
        top5 = ranked[:5]
        top5_labels = [p["label"] for p in top5]
        entropy = calculate_entropy(probs)

        # Baseline OOD / Uncertainty rule
        # Rule: score < 0.70 or entropy > 1.60 => uncertain
        is_uncertain = (top1["score"] < 0.70) or (entropy > 1.60)

        is_supported = entry["isSupported"]
        gt_label = entry["label"]

        # In-distribution top-1 & top-5 match
        is_top1_match = (top1["label"].lower() == gt_label.lower()) if is_supported else False
        is_top5_match = (gt_label.lower() in [l.lower() for l in top5_labels]) if is_supported else False

        # OOD behavior categorization:
        # True Negative (OOD correctly flagged uncertain)
        # False Positive / Confidently Wrong (OOD NOT flagged uncertain, falsely accepted with high confidence!)
        # False Negative / False Rejection (In-dist supported item incorrectly flagged uncertain)
        # True Positive (In-dist supported item correctly accepted with high confidence)
        ood_status = None
        if not is_supported:
            if is_uncertain:
                ood_status = "TRUE_OOD_FLAGGED"
            else:
                ood_status = "CONFIDENTLY_WRONG_FALSE_ACCEPTANCE"
        else:
            if is_uncertain:
                ood_status = "FALSE_REJECTION_UNCERTAIN"
            else:
                ood_status = "CORRECT_HIGH_CONFIDENCE_ACCEPTANCE" if is_top1_match else "CONFIDENTLY_WRONG_IN_DIST"

        record = {
            "id": entry["id"],
            "label": gt_label,
            "category": entry["category"],
            "isSupported": is_supported,
            "split": entry["split"],
            "top1Label": top1["label"],
            "top1Score": round(top1["score"], 4),
            "top5": [{"label": p["label"], "score": round(p["score"], 4)} for p in top5],
            "entropy": entropy,
            "isUncertain": is_uncertain,
            "isTop1Match": is_top1_match,
            "isTop5Match": is_top5_match,
            "oodStatus": ood_status,
            "latencyMs": round(latency_ms, 2)
        }
        records.append(record)

        tag = "[OK]" if is_top1_match or (not is_supported and is_uncertain) else "[FLAG]"
        print(f"[{record['id']}] {entry['category'][:18].ljust(18)} | GT: {gt_label[:14].ljust(14)} -> Pred: {top1['label'][:14].ljust(14)} ({top1['score']*100:5.1f}%) | H: {entropy:5.2f} | Unc: {str(is_uncertain):5} | {tag} ({ood_status})")

    # 3. Compute Metrics
    in_dist_records = [r for r in records if r["isSupported"]]
    ood_records = [r for r in records if not r["isSupported"]]

    # In-Distribution Metrics
    in_dist_total = len(in_dist_records)
    in_dist_top1_correct = sum(1 for r in in_dist_records if r["isTop1Match"])
    in_dist_top5_correct = sum(1 for r in in_dist_records if r["isTop5Match"])
    in_dist_top1_acc = (in_dist_top1_correct / in_dist_total * 100.0) if in_dist_total > 0 else 0.0
    in_dist_top5_acc = (in_dist_top5_correct / in_dist_total * 100.0) if in_dist_total > 0 else 0.0

    # OOD Detection Metrics
    ood_total = len(ood_records)
    ood_flagged_correctly = sum(1 for r in ood_records if r["isUncertain"])
    ood_confidently_wrong = sum(1 for r in ood_records if not r["isUncertain"])
    ood_detection_rate = (ood_flagged_correctly / ood_total * 100.0) if ood_total > 0 else 0.0

    # Per-Class Metrics for In-Distribution Classes
    class_stats = {}
    for r in in_dist_records:
        gt = r["label"]
        pred = r["top1Label"]
        if gt not in class_stats:
            class_stats[gt] = {"tp": 0, "fp": 0, "fn": 0}
        if pred == gt:
            class_stats[gt]["tp"] += 1
        else:
            class_stats[gt]["fn"] += 1

    # Confusion matrix
    confusion_matrix = defaultdict(lambda: defaultdict(int))
    for r in records:
        confusion_matrix[r["label"]][r["top1Label"]] += 1

    # Latencies
    avg_latency = round(sum(latencies) / len(latencies), 2)
    sorted_lat = sorted(latencies)
    p50_latency = round(sorted_lat[int(len(sorted_lat) * 0.50)], 2)
    p95_latency = round(sorted_lat[min(int(len(sorted_lat) * 0.95), len(sorted_lat)-1)], 2)

    # Threshold Audit: Val vs Test
    val_records = [r for r in records if r["split"] == "val"]
    test_records = [r for r in records if r["split"] == "test"]

    print("\n" + "=" * 80)
    print("STAGE 13 HONEST EVALUATION METRICS SUMMARY")
    print("=" * 80)
    print(f"Total Evaluated Genuine Images:        {len(records)}")
    print(f"  - In-Distribution (Supported 20):   {in_dist_total}")
    print(f"  - Out-of-Distribution (Unsupported): {ood_total}")
    print("-" * 80)
    print(f"In-Distribution Top-1 Accuracy:        {in_dist_top1_acc:.1f}% ({in_dist_top1_correct}/{in_dist_total})")
    print(f"In-Distribution Top-5 Accuracy:        {in_dist_top5_acc:.1f}% ({in_dist_top5_correct}/{in_dist_total})")
    print(f"OOD Uncertainty Detection Rate:        {ood_detection_rate:.1f}% ({ood_flagged_correctly}/{ood_total})")
    print(f"OOD Confidently Wrong (False Accepts): {ood_confidently_wrong}/{ood_total} ({ood_confidently_wrong/ood_total*100.1:.1f}%)")
    print("-" * 80)
    print(f"Inference Latency: Avg = {avg_latency}ms | P50 = {p50_latency}ms | P95 = {p95_latency}ms")
    print(f"Model Cold Startup Time:               {model_load_time_sec}s")
    print("=" * 80)

    # Save detailed evaluation results
    eval_results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "modelId": MODEL_NAME,
        "modelBackbone": model.config.model_type,
        "classesCount": num_classes,
        "coldStartTimeSec": model_load_time_sec,
        "totalEvaluated": len(records),
        "inDistribution": {
            "total": in_dist_total,
            "top1Correct": in_dist_top1_correct,
            "top1AccuracyPct": in_dist_top1_acc,
            "top5Correct": in_dist_top5_correct,
            "top5AccuracyPct": in_dist_top5_acc
        },
        "outOfDistribution": {
            "total": ood_total,
            "correctlyFlaggedUncertain": ood_flagged_correctly,
            "detectionRatePct": ood_detection_rate,
            "confidentlyWrongCount": ood_confidently_wrong,
            "confidentlyWrongDetails": [
                {
                    "id": r["id"],
                    "label": r["label"],
                    "falselyPredicted": r["top1Label"],
                    "confidence": r["top1Score"],
                    "entropy": r["entropy"]
                }
                for r in ood_records if not r["isUncertain"]
            ]
        },
        "latencyMs": {
            "average": avg_latency,
            "p50": p50_latency,
            "p95": p95_latency
        },
        "records": records,
        "confusionMatrix": {k: dict(v) for k, v in confusion_matrix.items()}
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    print(f"Saved evaluation results to: {OUTPUT_PATH}")

if __name__ == "__main__":
    run_evaluation()
