"""Run a project Blender script through the already running local MCP addon."""
import json
import socket
import sys
from pathlib import Path

script = Path(sys.argv[1]).resolve()
code = '__file__ = ' + repr(str(script)) + '\n' + script.read_text()
with socket.create_connection(('127.0.0.1', 9876), timeout=10) as connection:
    connection.settimeout(180)
    connection.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode())
    data = b''
    while True:
        chunk = connection.recv(262144)
        if not chunk:
            raise RuntimeError('Blender closed the connection before returning a complete result')
        data += chunk
        try:
            result = json.loads(data)
        except json.JSONDecodeError:
            continue
        print(json.dumps(result, ensure_ascii=False))
        if result.get('status') != 'success':
            sys.exit(1)
        break
