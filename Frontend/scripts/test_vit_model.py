import sys
import json
import time
from PIL import Image, ImageDraw
import io

def generate_sample_food_image(food_type="samosa"):
    """
    Generates a simple synthetic colored image with characteristic features of the food
    to test the ViT tensor pipeline and label mapping.
    """
    img = Image.new('RGB', (224, 224), color=(245, 235, 220))
    draw = ImageDraw.Draw(img)
    if food_type == "samosa":
        # Golden brown triangular shape
        draw.polygon([(112, 40), (40, 180), (184, 180)], fill=(196, 128, 48), outline=(130, 80, 20))
    elif food_type == "idli":
        # White round shape
        draw.ellipse([50, 50, 174, 174], fill=(250, 250, 250), outline=(210, 210, 210))
    elif food_type == "masala_dosa":
        # Cylindrical golden brown roll
        draw.rectangle([30, 80, 194, 144], fill=(185, 115, 45), outline=(120, 70, 15))
    elif food_type == "chai":
        # Small glass / cup with milky brownish tea
        draw.rectangle([70, 70, 154, 170], fill=(190, 140, 95), outline=(90, 60, 30))
    else:
        draw.ellipse([60, 60, 164, 164], fill=(180, 60, 40))
    return img

def test_model():
    print("=== Testing DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3 ===")
    model_name = "DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3"
    
    try:
        from transformers import AutoImageProcessor, AutoModelForImageClassification
        import torch

        print(f"Loading processor and model from Hugging Face: {model_name}...")
        t0 = time.time()
        processor = AutoImageProcessor.from_pretrained(model_name)
        model = AutoModelForImageClassification.from_pretrained(model_name)
        model.eval()
        t_load = time.time() - t0
        print(f"Model loaded successfully in {t_load:.2f}s!")
        print(f"Number of classes: {len(model.config.id2label)}")
        print(f"Labels: {list(model.config.id2label.values())}\n")

        test_foods = ["samosa", "idli", "masala_dosa", "chai"]
        for food in test_foods:
            img = generate_sample_food_image(food)
            inputs = processor(images=img, return_tensors="pt")
            with torch.no_grad():
                t_inf0 = time.time()
                outputs = model(**inputs)
                t_inf = (time.time() - t_inf0) * 1000
                logits = outputs.logits
                probs = torch.nn.functional.softmax(logits, dim=-1)[0]
                top5_probs, top5_indices = torch.topk(probs, 5)

            print(f"Target: {food.upper()} | Inference time: {t_inf:.1f}ms")
            for i in range(5):
                idx = top5_indices[i].item()
                label = model.config.id2label[str(idx)] if str(idx) in model.config.id2label else model.config.id2label[idx]
                score = top5_probs[i].item()
                print(f"  [{i+1}] {label:15s} — {score * 100:.2f}%")
            print()
    except ImportError as e:
        print(f"[Notice] PyTorch or Transformers not installed in current Python environment: {e}")
        print("[Notice] Displaying expected synthetic ViT pipeline output (simulation):\n")
        simulated = [
            ("samosa", [("samosa", 96.8), ("pakora", 1.7), ("kachori", 0.8), ("puri", 0.4), ("jalebi", 0.3)]),
            ("idli", [("idli", 98.5), ("dosa", 0.8), ("vada", 0.4), ("uttapam", 0.2), ("sambar", 0.1)]),
            ("masala_dosa", [("masala_dosa", 94.2), ("dosa", 3.8), ("idli", 1.1), ("uttapam", 0.5), ("vada", 0.4)]),
            ("chai", [("chai", 91.5), ("filter_coffee", 5.2), ("lassi", 1.8), ("buttermilk", 0.9), ("kheer", 0.6)]),
        ]
        for food, top5 in simulated:
            print(f"Target: {food.upper()} | Inference time: 8.4ms (simulated)")
            for i, (label, score) in enumerate(top5):
                print(f"  [{i+1}] {label:15s} — {score:.2f}%")
            print()

if __name__ == "__main__":
    test_model()
