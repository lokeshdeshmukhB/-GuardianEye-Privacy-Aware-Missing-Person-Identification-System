"""
Windows PyTorch import workaround - Run this instead of app.py directly
"""
import os
import sys
import warnings

# Suppress WMI-related warnings and errors
warnings.filterwarnings('ignore')
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'

# Patch platform.win32_ver() to avoid WMI hangs
import platform
_original_win32_ver = platform.win32_ver

def patched_win32_ver(*args, **kwargs):
    """Return sensible defaults instead of querying WMI"""
    return ('10', '0', '', 'Standalone')

platform.win32_ver = patched_win32_ver

# Now import and run the app
if __name__ == '__main__':
    from app import app
    app.run(debug=False, host='0.0.0.0', port=8000)
