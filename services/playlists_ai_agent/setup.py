"""Compatibility shim for environments that still invoke setup.py."""

from glob import glob

from setuptools import find_packages, setup


setup(
    name="playlists-ai-agent",
    version="0.1.0",
    description="Self-hosted learning-to-rank service for Playlists IA",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    python_requires=">=3.12,<3.15",
    package_dir={"": "src"},
    packages=find_packages("src"),
    data_files=[("share/playlists_ai_agent", glob("data/*.json"))],
    install_requires=[
        "fastapi>=0.110,<1",
        "pydantic>=1.10,<3",
        "uvicorn[standard]>=0.27,<1",
    ],
    extras_require={"test": ["httpx>=0.27,<1"]},
    entry_points={
        "console_scripts": [
            "playlists-ai-agent=playlists_ai_agent.__main__:main",
        ]
    },
)
