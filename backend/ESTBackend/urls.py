"""
URL configuration for ESTBackend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.views.static import serve

from .settings import FRONTEND_DIR

urlpatterns = [
    path("", RedirectView.as_view(url="/frontend/admin/login.html", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/", include("timetable.urls")),
    path("frontend/<path:path>", serve, {"document_root": FRONTEND_DIR}),
]