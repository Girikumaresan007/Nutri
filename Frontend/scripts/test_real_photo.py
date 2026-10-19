import os
import time
from PIL import Image
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification

def test_photos():
    model_name = "DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3"
    print("=== Evaluating ViT-Indian-Food Model on Realistic Food Photos ===")
    t0 = time.time()
    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForImageClassification.from_pretrained(model_name)
    model.eval()
    print(f"Model ready in {time.time() - t0:.2f}s\n")

    test_imgs = [
        ("Samosas (2 on plate with chutney)", "public/test_samosa.jpg", "samosa"),
        ("Idlis (3 on banana leaf with chutneys)", "public/test_idli.jpg", "idli"),
        ("Salad (Out of domain / non-Indian)", "public/test_salad.jpg", "NONE"),
    ]

    for title, path, expected in test_imgs:
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue
        img = Image.open(path).convert('RGB')
        t_start = time.time()
        inputs = processor(images=img, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]
            top5_probs, top5_indices = torch.topk(probs, 5)
        inf_ms = (time.time() - t_start) * 1000

        top1_idx = top5_indices[0].item()
        top1_label = model.config.id2label[str(top1_idx)] if str(top1_idx) in model.config.id2label else model.config.id2label[top1_idx]
        top1_score = top5_probs[0].item() * 100

        match = "MATCH" if top1_label.lower() == expected.lower() else ("OOD" if expected == "NONE" else "MISMATCH")
        print(f"Target: {title}")
        print(f"  Result: [{match}] Predicted '{top1_label}' ({top1_score:.1f}%) in {inf_ms:.1f}ms")
        print("  Top 5 Probabilities:")
        for i in range(5):
            idx = top5_indices[i].item()
            lbl = model.config.id2label[str(idx)] if str(idx) in model.config.id2label else model.config.id2label[idx]
            sc = top5_probs[i].item() * 100
            print(f"    {i+1}. {lbl:15s} : {sc:5.2f}%")
        print()

if __name__ == "__main__":
    test_photos()
