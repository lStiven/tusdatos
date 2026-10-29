from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parent.parent

ENV_EXAMPLE = ROOT / "backend" / ".env.example"
ENV_FILE = ROOT / "backend" / ".env"


def bootstrap():
    if not ENV_FILE.exists():
        if not ENV_EXAMPLE.exists():
            raise FileNotFoundError(
                f"No existe {ENV_EXAMPLE}"
            )

        ENV_FILE.write_text(
            ENV_EXAMPLE.read_text(encoding="utf-8"),
            encoding="utf-8",
        )

        print("[OK] Archivo .env creado")

    content = ENV_FILE.read_text(encoding="utf-8")

    lines = content.splitlines()

    updated = []
    jwt_found = False

    for line in lines:
        if line.startswith("JWT_SECRET_KEY="):
            jwt_found = True
            value = line.partition("=")[2].strip()

            if not value:
                secret = secrets.token_urlsafe(48)
                line = f"JWT_SECRET_KEY={secret}"
                print("[OK] JWT_SECRET_KEY generado")

        updated.append(line)

    if not jwt_found:
        raise ValueError(
            "JWT_SECRET_KEY no está definido en .env"
        )
    ENV_FILE.write_text(
        "\n".join(updated) + "\n",
        encoding="utf-8",
    )
    ENV_FILE.chmod(0o600)
    print("[OK] Entorno configurado")


if __name__ == "__main__":
    bootstrap()
