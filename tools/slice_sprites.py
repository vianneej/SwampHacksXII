"""Cut individual furniture sprites out of assets/PixelArtCafe.png into assets/sprites/."""
from PIL import Image
import numpy as np, cv2

NAMES = {
    4: "table_chairs_side", 3: "table_chair_back", 8: "table_chairs_three",
    24: "table_chairs_cup", 12: "chair_side_right", 13: "chair_back",
    28: "chair_side_left", 30: "chair_front", 6: "bar", 1: "espresso",
    2: "grinder", 5: "pastry_case", 7: "sink", 9: "crate", 11: "cups",
    18: "jar_a", 16: "jar_b", 17: "jar_c", 14: "pitcher", 15: "plant_small_counter",
    10: "menu_board", 19: "cafe_sign", 20: "lounge", 21: "plant_large",
    25: "plant_medium", 23: "plant_hanging", 26: "plant_flower", 22: "painting",
    27: "round_table_plant", 29: "round_table_cups", 32: "stool_table",
    33: "table_small", 34: "bench", 31: "rug",
}

src = np.array(Image.open("assets/PixelArtCafe.png"))
mask = (src[..., 3] > 215).astype(np.uint8)
grown = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
n, lab, stats, _ = cv2.connectedComponentsWithStats(grown)

for i, name in NAMES.items():
    x, y, w, h, _ = stats[i]
    out = src[y:y + h, x:x + w].copy()
    keep = (lab[y:y + h, x:x + w] == i) & (out[..., 3] > 215)
    out[..., 3] = np.where(keep, 255, 0)
    Image.fromarray(out).save(f"assets/sprites/{name}.png")
    print(f"{name}: {w}x{h}")
