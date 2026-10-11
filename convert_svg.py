import base64
from PIL import Image

def png_to_svg(png_path, svg_path):
    img = Image.open(png_path)
    w, h = img.size
    with open(png_path, 'rb') as f:
        b64_data = base64.b64encode(f.read()).decode('utf-8')
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%">
  <image href="data:image/png;base64,{b64_data}" width="{w}" height="{h}" />
</svg>'''
    with open(svg_path, 'w', encoding='utf-8') as out:
        out.write(svg_content)
    print(f"Created {svg_path} ({w}x{h})")

if __name__ == '__main__':
    png_to_svg('static/img_interview.png', 'static/illustration_interview.svg')
    png_to_svg('static/img_remote.png', 'static/illustration_remote.svg')
    png_to_svg('static/img_envelope.png', 'static/illustration_envelope.svg')
